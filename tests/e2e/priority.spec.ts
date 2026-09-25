import { expect, test, type BrowserContext, type Page } from '@playwright/test';

async function registerTestUser(page: Page, context: BrowserContext): Promise<void> {
    const cdp = await context.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
        options: {
            protocol: 'ctap2',
            transport: 'internal',
            hasResidentKey: true,
            hasUserVerification: true,
            isUserVerified: true,
            automaticPresenceSimulation: true,
        },
    });

    await page.goto('/login');
    await page.getByPlaceholder('Username').fill(`priority-${Date.now()}-${Math.floor(Math.random() * 10000)}`);
    await page.getByRole('button', { name: 'Create passkey' }).click();
    await page.waitForURL('**/');
}

function singaporeDateTime(daysFromNow: number): string {
    const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Singapore',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
        result[part.type] = part.value;
        return result;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

async function createTodo(page: Page, title: string, priority: 'High' | 'Medium' | 'Low'): Promise<void> {
    await page.getByLabel('Todo title').fill(title);
    await page.getByLabel('Create priority').selectOption(priority.toLowerCase());
    await page.getByLabel('Due date').fill(singaporeDateTime(1));
    await page.getByRole('button', { name: 'Add task' }).click();
    await expect(page.locator('li.todo-card', { hasText: title })).toContainText(priority);
}

test.describe('Priority system', () => {
    test.beforeEach(async ({ page, context }) => {
        await registerTestUser(page, context);
        await page.goto('/');
    });

    test('creates todos with each priority and displays color-coded labels', async ({ page }) => {
        await createTodo(page, 'High priority task', 'High');
        await createTodo(page, 'Medium priority task', 'Medium');
        await createTodo(page, 'Low priority task', 'Low');

        await expect(page.locator('li.todo-card.priority-high .priority-badge')).toHaveCSS('color', 'rgb(185, 28, 28)');
        await expect(page.locator('li.todo-card.priority-medium .priority-badge')).toHaveCSS('color', 'rgb(161, 98, 7)');
        await expect(page.locator('li.todo-card.priority-low .priority-badge')).toHaveCSS('color', 'rgb(29, 78, 216)');
    });

    test('defaults new todos to medium priority', async ({ page }) => {
        const title = 'Default priority task';
        await page.getByLabel('Todo title').fill(title);
        await page.getByLabel('Due date').fill(singaporeDateTime(1));
        await page.getByRole('button', { name: 'Add task' }).click();

        await expect(page.locator('li.todo-card', { hasText: title })).toContainText('Medium');
    });

    test('edits a todo priority', async ({ page }) => {
        await createTodo(page, 'Priority edit task', 'Medium');
        const todo = page.locator('li.todo-card', { hasText: 'Priority edit task' });

        await todo.getByRole('button', { name: 'Edit' }).click();
        const editForm = page.locator('form.edit-form');
        await editForm.getByLabel('Edit priority').selectOption('high');
        await editForm.getByRole('button', { name: 'Save' }).click();

        await expect(todo).toHaveClass(/priority-high/);
        await expect(todo).toContainText('High');
    });

    test('filters todos by priority', async ({ page }) => {
        await createTodo(page, 'Visible high task', 'High');
        await createTodo(page, 'Hidden medium task', 'Medium');
        await createTodo(page, 'Hidden low task', 'Low');

        await page.getByLabel('Filter by priority').selectOption('high');

        await expect(page.locator('li.todo-card')).toHaveCount(1);
        await expect(page.locator('li.todo-card')).toContainText('Visible high task');
        await expect(page.getByText('Hidden medium task')).toHaveCount(0);
        await expect(page.getByText('Hidden low task')).toHaveCount(0);

        await page.getByLabel('Filter by priority').selectOption('all');
        await expect(page.locator('li.todo-card')).toHaveCount(3);
    });

    test('sorts pending todos from high to low priority', async ({ page }) => {
        await createTodo(page, 'Low sort task', 'Low');
        await createTodo(page, 'High sort task', 'High');
        await createTodo(page, 'Medium sort task', 'Medium');

        await expect(page.locator('li.todo-card')).toHaveText([
            /High sort task.*High/s,
            /Medium sort task.*Medium/s,
            /Low sort task.*Low/s,
        ]);
    });
});
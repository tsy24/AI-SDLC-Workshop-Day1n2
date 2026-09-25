import { expect, type BrowserContext, type Page } from '@playwright/test';

export async function registerTestUser(page: Page, context: BrowserContext, prefix: string): Promise<string> {
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
    const username = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    await page.getByPlaceholder('Username').fill(username);
    await page.getByRole('button', { name: 'Create passkey' }).click();
    await page.waitForURL('**/');
    return username;
}

export function singaporeDateTime(minutesFromNow: number): string {
    const date = new Date(Date.now() + minutesFromNow * 60 * 1000);
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

export async function createTodo(
    page: Page,
    title: string,
    options: { priority?: 'high' | 'medium' | 'low'; dueDateMinutes?: number } = {},
): Promise<void> {
    await page.getByLabel('Todo title').fill(title);
    if (options.priority) await page.getByLabel('Create priority').selectOption(options.priority);
    if (options.dueDateMinutes !== undefined) await page.getByLabel('Due date').fill(singaporeDateTime(options.dueDateMinutes));
    const createResponse = page.waitForResponse((response) => response.url().endsWith('/api/todos') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Add task' }).click();
    await expect((await createResponse).ok()).toBe(true);
    await expectTodo(page, title);
}

export async function expectTodo(page: Page, title: string): Promise<void> {
    await expect(page.locator('li.todo-card', { hasText: title })).toBeVisible();
}
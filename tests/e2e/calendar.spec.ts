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
    await page.getByPlaceholder('Username').fill(`calendar-${Date.now()}-${Math.floor(Math.random() * 10000)}`);
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

function singaporeMonthKey(): string {
    const date = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit' })
        .formatToParts(date).reduce<Record<string, string>>((result, part) => {
            result[part.type] = part.value;
            return result;
        }, {});
    return `${parts.year}-${parts.month}`;
}

function shiftMonth(monthKey: string, amount: number): string {
    const date = new Date(`${monthKey}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + amount);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

test.describe('Calendar view', () => {
    test.beforeEach(async ({ page, context }) => {
        await registerTestUser(page, context);
    });

    test('loads the current month and navigates between months', async ({ page }) => {
        await page.goto('/calendar');
        const currentMonth = await page.locator('h1').textContent();
        await expect(page.locator('.calendar-cell')).toHaveCount(42);
        await expect(page.locator('.weekday-row span')).toHaveCount(7);
        await expect(page.locator('.calendar-cell.weekend')).toHaveCount(12);
        await expect(page.locator('.calendar-cell.today')).toHaveCount(1);

        await page.getByRole('button', { name: 'Previous month' }).click();
        const currentMonthKey = singaporeMonthKey();
        await expect(page).toHaveURL(`/calendar?month=${shiftMonth(currentMonthKey, -1)}`);
        await expect(page.locator('h1')).not.toHaveText(currentMonth ?? '');

        await page.getByRole('button', { name: 'Next month' }).click();
        await expect(page).toHaveURL(`/calendar?month=${currentMonthKey}`);
        await expect(page.locator('h1')).toHaveText(currentMonth ?? '');
    });

    test('Today returns to the current month', async ({ page }) => {
        await page.goto('/calendar?month=2026-02');
        await page.getByRole('button', { name: 'Today' }).click();
        const currentMonthKey = singaporeMonthKey();
        await expect(page).toHaveURL(`/calendar?month=${currentMonthKey}`);
    });

    test('renders a todo on its Singapore due date and opens day details', async ({ page }) => {
        const title = `Calendar task ${Date.now()}`;
        const dueDateTime = singaporeDateTime(1);
        await page.goto('/');
        await page.getByLabel('Todo title').fill(title);
        await page.getByLabel('Due date').fill(dueDateTime);
        await page.getByRole('button', { name: 'Add task' }).click();
        await expect(page.getByText(title)).toBeVisible();

        await page.getByRole('link', { name: 'Open calendar month view' }).click();
        const calendarTodo = page.locator('.calendar-todo', { hasText: title });
        await expect(calendarTodo).toBeVisible();
        const dueDate = dueDateTime.slice(0, 10);
        const dueDateCell = page.locator(`[data-date="${dueDate}"]`);
        await expect(dueDateCell).toContainText(title);
        await dueDateCell.click();
        await expect(page.getByRole('dialog', { name: /Todos for/ })).toContainText(title);
    });

    test('renders seeded holidays', async ({ page }) => {
        await page.goto('/calendar?month=2026-02');
        const holidayCell = page.locator('[data-date="2026-02-17"]');
        await expect(holidayCell).toContainText('Chinese New Year');
        await holidayCell.click();
        await expect(page.getByRole('dialog', { name: 'Todos for 2026-02-17' })).toContainText('Chinese New Year');
    });
});

test('redirects unauthenticated users from the calendar', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page).toHaveURL(/\/login/);
});

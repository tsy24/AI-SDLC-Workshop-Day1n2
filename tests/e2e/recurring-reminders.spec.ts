import { expect, test } from '@playwright/test';

import { createTodo, registerTestUser, singaporeDateTime } from '../helpers';

async function submitTodo(page: import('@playwright/test').Page): Promise<void> {
    const response = page.waitForResponse((item) => item.url().endsWith('/api/todos') && item.request().method() === 'POST');
    await page.getByRole('button', { name: 'Add task' }).click();
    await expect((await response).ok()).toBe(true);
}

test.describe('Recurring todos and reminders', () => {
    test.beforeEach(async ({ page, context }) => {
        await registerTestUser(page, context, 'recurring');
        await page.goto('/');
    });

    test('creates daily and weekly recurring todos', async ({ page }) => {
        const form = page.locator('form.quick-add-card');

        await page.getByLabel('Todo title').fill('Daily recurring task');
        await page.getByLabel('Due date').fill(singaporeDateTime(60));
        await form.getByLabel('Repeat').check();
        await page.getByLabel('Recurrence pattern').selectOption('daily');
        await submitTodo(page);
        await expect(page.locator('li.todo-card', { hasText: 'Daily recurring task' })).toContainText('daily');

        await page.getByLabel('Todo title').fill('Weekly recurring task');
        await page.getByLabel('Due date').fill(singaporeDateTime(120));
        await form.getByLabel('Repeat').check();
        await page.getByLabel('Recurrence pattern').selectOption('weekly');
        await submitTodo(page);
        await expect(page.locator('li.todo-card', { hasText: 'Weekly recurring task' })).toContainText('weekly');
    });

    test('creates the next instance when a recurring todo is completed', async ({ page }) => {
        const title = 'Recurring completion task';
        const form = page.locator('form.quick-add-card');
        await page.getByLabel('Todo title').fill(title);
        await page.getByLabel('Due date').fill(singaporeDateTime(60));
        await form.getByLabel('Repeat').check();
        await page.getByLabel('Recurrence pattern').selectOption('daily');
        await submitTodo(page);

        const todo = page.locator('li.todo-card:not(.is-complete)', { hasText: title });
        await todo.getByLabel(`Complete ${title}`).click();

        await expect(page.locator('li.todo-card', { hasText: title })).toHaveCount(2);
        await expect(page.locator('li.todo-card.is-complete', { hasText: title })).toHaveCount(1);
        await expect(page.locator('li.todo-card:not(.is-complete)', { hasText: title })).toHaveCount(1);
    });

    test('enables reminders only with a due date and shows the reminder badge', async ({ page }) => {
        const reminder = page.getByLabel('Reminder');
        await expect(reminder).toBeDisabled();

        await page.getByLabel('Todo title').fill('Reminder task');
        await page.getByLabel('Due date').fill(singaporeDateTime(60));
        await expect(reminder).toBeEnabled();
        await reminder.selectOption('60');
        await submitTodo(page);

        await expect(page.locator('li.todo-card', { hasText: 'Reminder task' })).toContainText('Bell 1h');
    });

    test('returns due reminders and prevents duplicate notification checks', async ({ page }) => {
        const title = 'Due reminder API task';
        await page.getByLabel('Todo title').fill(title);
        await page.getByLabel('Due date').fill(singaporeDateTime(2));
        await page.getByLabel('Reminder').selectOption('15');
        await page.getByRole('button', { name: 'Add task' }).click();

        const todos = await page.evaluate(async () => (await fetch('/api/todos')).json()) as Array<{ id: number; title: string }>;
        const todo = todos.find((item) => item.title === title);
        expect(todo).toBeDefined();

        const firstCheck = await page.evaluate(async () => (await fetch('/api/notifications/check')).json()) as { data: Array<{ title: string }> };
        expect(firstCheck.data.some((item) => item.title === title)).toBe(true);

        const updateResponse = await page.evaluate(async (id) => {
            const response = await fetch(`/api/todos/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ last_notification_sent: new Date().toISOString() }),
            });
            return response.ok;
        }, todo?.id);
        expect(updateResponse).toBe(true);
        const secondCheck = await page.evaluate(async () => (await fetch('/api/notifications/check')).json()) as { data: Array<{ title: string }> };
        expect(secondCheck.data.some((item) => item.title === title)).toBe(false);
    });
});
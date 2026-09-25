import { expect, test } from '@playwright/test';

import { createTodo, registerTestUser } from '../helpers';

test.describe('Export and import', () => {
    test.beforeEach(async ({ page, context }) => {
        await registerTestUser(page, context, 'export');
        await page.goto('/');
        await expect(page.getByText('You have no todos yet.')).toBeVisible();
    });

    test('exports JSON and imports the exported payload', async ({ page }) => {
        await createTodo(page, 'Exported task', { dueDateMinutes: 60 });
        const exported = await page.evaluate(async () => {
            const response = await fetch('/api/todos/export?format=json');
            return { ok: response.ok, payload: await response.json() };
        });
        expect(exported.ok).toBe(true);
        expect(exported.payload).toMatchObject({ version: 1, todos: [{ title: 'Exported task' }] });

        await page.locator('input[type="file"]').setInputFiles({
            name: 'todos.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify(exported.payload)),
        });
        await expect(page.getByRole('status')).toContainText('Successfully imported 1 todos');
        await expect(page.locator('li.todo-card', { hasText: 'Exported task' })).toHaveCount(2);
    });

    test('shows an error for invalid JSON imports', async ({ page }) => {
        await page.locator('input[type="file"]').setInputFiles({
            name: 'invalid.json',
            mimeType: 'application/json',
            buffer: Buffer.from('{ invalid json'),
        });
        await expect(page.getByRole('status')).toContainText('Invalid JSON format');
    });
});
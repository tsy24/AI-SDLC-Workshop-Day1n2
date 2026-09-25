import { expect, test } from '@playwright/test';

import { createTodo, registerTestUser } from '../helpers';

test.describe('Search and filtering', () => {
    test.beforeEach(async ({ page, context }) => {
        await registerTestUser(page, context, 'search');
        await page.goto('/');
        await expect(page.getByText('You have no todos yet.')).toBeVisible();
    });

    test('searches todo titles case-insensitively', async ({ page }) => {
        await createTodo(page, 'Write Project Brief', { dueDateMinutes: 60 });
        await createTodo(page, 'Buy Groceries', { dueDateMinutes: 120 });

        await page.getByLabel('Search todos and subtasks').fill('project');
        await expect(page.locator('li.todo-card')).toHaveCount(1);
        await expect(page.locator('li.todo-card')).toContainText('Write Project Brief');
        await expect(page.getByText('Buy Groceries')).toHaveCount(0);
    });

    test('combines search and priority filters and clears them', async ({ page }) => {
        await createTodo(page, 'High work task', { priority: 'high', dueDateMinutes: 60 });
        await createTodo(page, 'Medium work task', { priority: 'medium', dueDateMinutes: 120 });
        await createTodo(page, 'High home task', { priority: 'high', dueDateMinutes: 180 });

        await page.getByLabel('Search todos and subtasks').fill('work');
        await page.getByLabel('Filter by priority').selectOption('high');
        await expect(page.locator('li.todo-card')).toHaveCount(1);
        await expect(page.locator('li.todo-card')).toContainText('High work task');

        await page.getByRole('button', { name: 'Clear All' }).click();
        await expect(page.locator('li.todo-card')).toHaveCount(3);
    });
});
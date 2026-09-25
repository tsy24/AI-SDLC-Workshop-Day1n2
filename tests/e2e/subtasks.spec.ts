import { expect, test } from '@playwright/test';

import { createTodo, registerTestUser } from '../helpers';

test.describe('Subtasks and progress', () => {
    test.beforeEach(async ({ page, context }) => {
        await registerTestUser(page, context, 'subtasks');
        await page.goto('/');
        await expect(page.getByText('You have no todos yet.')).toBeVisible();
    });

    test('adds, completes, and deletes subtasks while updating progress', async ({ page }) => {
        const title = 'Subtask parent';
        await createTodo(page, title, { dueDateMinutes: 60 });
        const todo = page.locator('li.todo-card', { hasText: title });
        await todo.getByRole('button', { name: /Subtasks/ }).click();

        const firstInput = todo.getByLabel(`Add subtask to ${title}`);
        await firstInput.fill('First subtask');
        const firstResponse = page.waitForResponse((response) => response.url().includes('/api/todos/') && response.url().endsWith('/subtasks') && response.request().method() === 'POST');
        await todo.getByRole('button', { name: 'Add' }).click();
        await expect((await firstResponse).ok()).toBe(true);
        await firstInput.fill('Second subtask');
        const secondResponse = page.waitForResponse((response) => response.url().includes('/api/todos/') && response.url().endsWith('/subtasks') && response.request().method() === 'POST');
        await todo.getByRole('button', { name: 'Add' }).click();
        await expect((await secondResponse).ok()).toBe(true);

        await expect(todo).toContainText('0/2 subtasks');
        await expect(todo).toContainText('0%');
        await todo.getByLabel('Complete subtask First subtask').check();
        await expect(todo).toContainText('1/2 subtasks');
        await expect(todo).toContainText('50%');
        await expect(todo.locator('.progress-fill')).toHaveCSS('background-color', 'rgb(37, 99, 235)');

        await todo.getByLabel('Delete subtask Second subtask').click();
        await expect(todo).toContainText('1/1 subtasks');
        await expect(todo).toContainText('100%');
        await expect(todo.locator('.progress-fill')).toHaveCSS('background-color', 'rgb(22, 163, 74)');
        await expect(todo).not.toContainText('Second subtask');
    });

    test('removes a todo and its subtasks together', async ({ page }) => {
        const title = 'Cascade parent';
        await createTodo(page, title, { dueDateMinutes: 60 });
        const todo = page.locator('li.todo-card', { hasText: title });
        await todo.getByRole('button', { name: /Subtasks/ }).click();
        await todo.getByLabel(`Add subtask to ${title}`).fill('Cascade subtask');
        const response = page.waitForResponse((item) => item.url().includes('/api/todos/') && item.url().endsWith('/subtasks') && item.request().method() === 'POST');
        await todo.getByRole('button', { name: 'Add' }).click();
        await expect((await response).ok()).toBe(true);
        await expect(todo).toContainText('Cascade subtask');

        page.once('dialog', (dialog) => dialog.accept());
        await todo.getByRole('button', { name: 'Delete', exact: true }).click();
        await expect(page.locator('li.todo-card', { hasText: title })).toHaveCount(0);
        await expect(page.getByText('Cascade subtask')).toHaveCount(0);
    });
});
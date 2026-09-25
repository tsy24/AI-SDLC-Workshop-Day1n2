import { expect, test } from '@playwright/test';

import { createTodo, registerTestUser, singaporeDateTime } from '../helpers';

test.describe('Todo CRUD', () => {
    test.beforeEach(async ({ page, context }) => {
        await registerTestUser(page, context, 'crud');
        await page.goto('/');
        await expect(page.getByText('You have no todos yet.')).toBeVisible();
    });

    test('creates, edits, completes, and deletes a todo', async ({ page }) => {
        await createTodo(page, 'Original task');
        const original = page.locator('li.todo-card', { hasText: 'Original task' });

        await original.getByRole('button', { name: 'Edit', exact: true }).click();
        const editForm = page.locator('form.edit-form');
        await editForm.getByLabel('Edit todo title').fill('Edited task');
        const editResponse = page.waitForResponse((response) => response.url().includes('/api/todos/') && response.request().method() === 'PUT');
        await editForm.getByRole('button', { name: 'Save', exact: true }).click();
        await expect((await editResponse).ok()).toBe(true);
        const edited = page.locator('li.todo-card', { hasText: 'Edited task' });
        await expect(edited).toBeVisible();

        const completeResponse = page.waitForResponse((response) => response.url().includes('/api/todos/') && response.request().method() === 'PUT');
        await edited.getByLabel('Complete Edited task').click();
        await expect((await completeResponse).ok()).toBe(true);
        await expect(edited).toHaveClass(/is-complete/);

        page.once('dialog', (dialog) => dialog.accept());
        const deleteResponse = page.waitForResponse((response) => response.url().includes('/api/todos/') && response.request().method() === 'DELETE');
        await edited.getByRole('button', { name: 'Delete', exact: true }).click();
        await expect((await deleteResponse).ok()).toBe(true);
        await expect(page.locator('li.todo-card', { hasText: 'Edited task' })).toHaveCount(0);
    });

    test('rejects a past due date', async ({ page }) => {
        await page.getByLabel('Todo title').fill('Invalid due date task');
        await page.getByLabel('Due date').fill(singaporeDateTime(-5));
        await page.getByRole('button', { name: 'Add task' }).click();

        await expect(page.getByText('Due date must be at least 1 minute in the future')).toBeVisible();
        await expect(page.locator('li.todo-card', { hasText: 'Invalid due date task' })).toHaveCount(0);
    });
});
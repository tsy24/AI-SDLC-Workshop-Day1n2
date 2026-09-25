import { expect, test } from '@playwright/test';

import { createTodo, registerTestUser } from '../helpers';

test.describe('Tag system', () => {
    test.beforeEach(async ({ page, context }) => {
        await registerTestUser(page, context, 'tags');
        await page.goto('/');
    });

    test('creates, assigns, filters, edits, and deletes tags', async ({ page }) => {
        await page.getByRole('button', { name: '+ Manage Tags' }).click();
        const modal = page.getByRole('dialog', { name: 'Manage Tags' });
        await modal.getByLabel('Tag name').fill('Work');
        await modal.getByRole('button', { name: 'Create' }).click();
        await expect(modal.getByRole('button', { name: /Work/ })).toBeVisible();
        await modal.getByLabel('Tag name').fill('Personal');
        await modal.getByRole('button', { name: 'Create' }).click();
        await expect(modal.getByRole('button', { name: /Personal/ })).toBeVisible();

        await modal.getByLabel('Tag name').fill('Work');
        await modal.getByRole('button', { name: 'Create' }).click();
        await expect(page.getByText('A tag with this name already exists')).toBeVisible();
        await modal.getByRole('button', { name: 'Close' }).click();

        await page.getByRole('button', { name: 'Work', exact: true }).click();
        await page.getByRole('button', { name: 'Personal', exact: true }).click();
        await createTodo(page, 'Tagged task');
        const todo = page.locator('li.todo-card', { hasText: 'Tagged task' });
        await expect(todo).toContainText('Work');
        await expect(todo).toContainText('Personal');

        await page.getByLabel('Filter by tag').selectOption({ label: 'Work' });
        await expect(page.locator('li.todo-card')).toHaveCount(1);
        await page.getByLabel('Filter by tag').selectOption('all');

        await page.getByRole('button', { name: '+ Manage Tags' }).click();
        const manageModal = page.getByRole('dialog', { name: 'Manage Tags' });
        const workRow = manageModal.getByRole('button', { name: /Work/ }).locator('..');
        await workRow.getByRole('button', { name: 'Edit' }).click();
        await page.getByLabel('Edit tag Work').fill('Projects');
        await page.getByRole('button', { name: 'Save' }).click();
        await expect(page.locator('li.todo-card', { hasText: 'Tagged task' })).toContainText('Projects');

        const projectsRow = manageModal.getByRole('button', { name: /Projects/ }).locator('..');
        await projectsRow.getByRole('button', { name: 'Delete' }).click();
        await expect(page.locator('li.todo-card', { hasText: 'Tagged task' })).not.toContainText('Projects');
        await page.getByRole('button', { name: 'Close' }).click();
    });
});
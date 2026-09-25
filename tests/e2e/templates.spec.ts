import { expect, test } from '@playwright/test';

import { registerTestUser, singaporeDateTime } from '../helpers';

test.describe('Template system', () => {
    test.beforeEach(async ({ page, context }) => {
        await registerTestUser(page, context, 'templates');
        await page.goto('/');
    });

    test('saves, uses, and deletes a template with metadata and subtasks', async ({ page }) => {
        const form = page.locator('form.quick-add-card');
        await page.getByLabel('Todo title').fill('Template task');
        await page.getByLabel('Create priority').selectOption('high');
        await page.getByLabel('Due date').fill(singaporeDateTime(120));
        await form.getByLabel('Repeat').check();
        await page.getByLabel('Recurrence pattern').selectOption('daily');
        await page.getByLabel('Reminder').selectOption('60');
        await page.getByLabel('Add draft subtask').fill('Template subtask one');
        await page.getByRole('button', { name: 'Add subtask' }).click();
        await page.getByLabel('Add draft subtask').fill('Template subtask two');
        await page.getByRole('button', { name: 'Add subtask' }).click();
        await page.getByRole('button', { name: 'Save as Template' }).click();

        const saveModal = page.getByRole('dialog', { name: 'Save as Template' });
        await saveModal.getByLabel('Template name').fill('Daily work template');
        await saveModal.getByLabel('Template description').fill('Reusable daily task');
        await saveModal.getByLabel('Template category').fill('Work');
        await saveModal.getByRole('button', { name: 'Save Template' }).click();

        await page.getByRole('button', { name: 'Templates' }).click();
        const manager = page.getByRole('dialog', { name: 'Templates' });
        const template = manager.getByText('Daily work template', { exact: true }).locator('..').locator('..');
        await expect(template).toContainText('Work');
        await expect(template).toContainText('High');
        await expect(template).toContainText('Repeat daily');
        await expect(template).toContainText('Bell 1h');

        await template.getByRole('button', { name: 'Use' }).click();
        await expect(page.locator('li.todo-card', { hasText: 'Template task' })).toBeVisible();
        const todo = page.locator('li.todo-card', { hasText: 'Template task' });
        await todo.getByRole('button', { name: /Subtasks/ }).click();
        await expect(todo).toContainText('Template subtask one');
        await expect(todo).toContainText('Template subtask two');

        await page.getByRole('button', { name: 'Templates' }).click();
        const reopenedManager = page.getByRole('dialog', { name: 'Templates' });
        const reopenedTemplate = reopenedManager.getByText('Daily work template', { exact: true }).locator('..').locator('..');
        page.once('dialog', (dialog) => dialog.accept());
        await reopenedTemplate.getByRole('button', { name: 'Delete' }).click();
        await expect(reopenedManager.getByText('Daily work template', { exact: true })).toHaveCount(0);
        await page.getByRole('button', { name: 'Close' }).click();
        await expect(page.locator('li.todo-card', { hasText: 'Template task' })).toBeVisible();
    });
});
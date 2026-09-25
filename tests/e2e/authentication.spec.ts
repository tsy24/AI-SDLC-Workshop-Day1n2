import { expect, test } from '@playwright/test';

import { registerTestUser } from '../helpers';

test('registers, logs out, and logs back in with a passkey', async ({ page, context }) => {
    const username = await registerTestUser(page, context, 'auth');
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.getByPlaceholder('Username').fill(username);
    await page.getByRole('button', { name: 'Use existing passkey' }).click();
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
});

test('redirects unauthenticated users from the todo page', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
});
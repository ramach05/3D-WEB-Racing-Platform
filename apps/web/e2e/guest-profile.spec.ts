import { expect, test } from '@playwright/test';

test('guest profile shows login call to action', async ({ page }) => {
  await page.goto('/profile');
  await expect(page.getByText(/нужно войти|log in to see/i)).toBeVisible();
  await expect(page.locator('#main').getByRole('link', { name: /вход|log in/i })).toHaveAttribute(
    'href',
    '/login',
  );
});

import { expect, test } from '@playwright/test';

test('register then logout returns to guest nav', async ({ page }) => {
  const nickname = `out_${Date.now().toString(36).slice(-10)}`;

  await page.goto('/register');
  await page.locator('input[name="nickname"]').fill(nickname);
  await page.locator('input[name="password"]').fill('1234');
  await page.getByRole('button', { name: /создать аккаунт|create account/i }).click();
  await expect(page).toHaveURL(/profile/);

  await page.getByRole('button', { name: /выйти|log out/i }).click();
  await expect(page.getByRole('banner').getByRole('link', { name: /вход|log in/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /выйти|log out/i })).toHaveCount(0);
});

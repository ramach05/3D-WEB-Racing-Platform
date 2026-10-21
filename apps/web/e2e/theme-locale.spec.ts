import { expect, test } from '@playwright/test';

test('theme and locale toggles persist', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /тема|theme/i }).click();
  await page.getByRole('option', { name: /тёмная|dark/i }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem('racing-theme'))).toBe('dark');

  await page.getByRole('button', { name: /язык|language/i }).click();
  await page.getByRole('option', { name: 'English' }).click();
  expect(await page.evaluate(() => localStorage.getItem('racing-locale'))).toBe('en');
  await expect(page.getByRole('button', { name: /language/i })).toBeVisible();
});

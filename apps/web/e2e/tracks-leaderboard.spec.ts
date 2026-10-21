import { expect, test } from '@playwright/test';

test('tracks start links and leaderboard tabs', async ({ page }) => {
  await page.goto('/tracks');
  await expect(page.getByRole('heading', { name: /трассы|tracks/i })).toBeVisible();
  const startLink = page.getByRole('link', { name: /старт|start/i }).first();
  await expect(startLink).toHaveAttribute('href', /\/race\//);

  await page.goto('/leaderboard');
  const tabs = page.getByRole('tab');
  await expect(tabs.first()).toBeVisible();
  const count = await tabs.count();
  expect(count).toBeGreaterThan(1);
  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
});

import { expect, test } from '@playwright/test';

test('register, stub a finish, see time on profile and leaderboard', async ({ page }) => {
  test.setTimeout(120_000);
  const nickname = `e2e_${Date.now()}`;

  await page.goto('/register');
  await page.locator('input[name="nickname"]').fill(nickname);
  await page.locator('input[name="password"]').fill('1234');
  await page.getByRole('button', { name: /создать аккаунт|create account/i }).click();
  await expect(page).toHaveURL(/profile/);

  await page.goto('/tracks');
  await page
    .getByRole('link', { name: /старт|start/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/race\//);

  await page.waitForFunction(() => {
    return (
      typeof (window as Window & { __finishRaceForTest?: () => void }).__finishRaceForTest ===
      'function'
    );
  });
  // HUD and overlays mount only after the scene's first frame (software WebGL can be slow)
  await expect(page.getByText(/скорость|speed/i)).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => {
    (window as Window & { __finishRaceForTest?: () => void }).__finishRaceForTest?.();
  });

  const finishDialog = page.getByRole('dialog');
  // the results dialog opens after the fixed 4s FINISH! moment
  await expect(finishDialog).toBeVisible({ timeout: 15_000 });
  await expect(finishDialog.getByRole('heading', { name: /финиш|finish/i })).toBeVisible();
  await expect(finishDialog.getByText(/00:33/).first()).toBeVisible();

  await page.goto('/profile');
  await expect(page.getByText(/00:33/).first()).toBeVisible();

  await page.goto('/leaderboard');
  await expect(page.locator('#main').getByText(nickname)).toBeVisible();
});

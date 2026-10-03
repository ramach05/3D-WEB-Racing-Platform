import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export const playwrightConfig = defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5180',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command:
        'pnpm --filter @racing/shared build && pnpm --filter @racing/api build && pnpm --filter @racing/api exec prisma migrate deploy && pnpm --filter @racing/api exec prisma db seed && pnpm --filter @racing/api start',
      cwd: repoRoot,
      url: 'http://localhost:3100/health',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: 'pnpm --filter @racing/web dev',
      cwd: repoRoot,
      url: 'http://localhost:5180',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});

export { playwrightConfig as default };

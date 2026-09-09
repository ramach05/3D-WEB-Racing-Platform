import { defineConfig, mergeConfig } from 'vitest/config';
import { viteConfig } from './vite.config';

export const vitestConfig = mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      restoreMocks: true,
    },
  }),
);

export { vitestConfig as default };

import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));
const sharedSrc = fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url));

/** Vite config for apps/web */
export const viteConfig = defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': srcDir,
      '@racing/shared': sharedSrc,
    },
  },
  server: {
    port: 5180,
    strictPort: true,
  },
});

export { viteConfig as default };

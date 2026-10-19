import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '@/app';
import { applyTheme, readStoredTheme } from '@/features/theme-switcher';

applyTheme(readStoredTheme());

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('#root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '@/app';
import { applyTheme, readStoredTheme } from '@/features/theme-switcher';

applyTheme(readStoredTheme());

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Не найден #root');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
);

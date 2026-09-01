import type { ThemeName } from '@/shared/config';
import { THEME_STORAGE_KEY } from '@/shared/config';

/** Читает сохранённую тему или системную */
export const readStoredTheme = (): ThemeName => {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/** Вешает class dark на html и пишет localStorage */
export const applyTheme = (theme: ThemeName): void => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem(THEME_STORAGE_KEY, theme);
};

/** Переключает светлую и тёмную тему */
export const toggleTheme = (current: ThemeName): ThemeName => {
  return current === 'dark' ? 'light' : 'dark';
};

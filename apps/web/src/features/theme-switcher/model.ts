import type { TCssColor, TThemeName, TUiColorToken } from '@/shared/config';
import { THEME_STORAGE_KEY, uiChrome, uiPalette } from '@/shared/config';

/** Читает сохранённую тему или системную */
export const readStoredTheme = (): TThemeName => {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/** Вешает class dark на html, пишет CSS-переменные из палитры и localStorage */
export const applyTheme = (theme: TThemeName): void => {
  const root = document.documentElement;
  const colors: Record<TUiColorToken, TCssColor> = uiPalette[theme];

  for (const token of Object.keys(colors) as TUiColorToken[]) {
    root.style.setProperty(`--${token}`, colors[token]);
  }

  root.style.setProperty('--on-yellow', uiChrome.onYellow);
  root.style.setProperty('--finish-wipe-dark', uiChrome.finishWipeDark);
  root.style.setProperty('--finish-wipe-light', uiChrome.finishWipeLight);

  root.classList.toggle('dark', theme === 'dark');
  localStorage.setItem(THEME_STORAGE_KEY, theme);
};

/** Переключает светлую и тёмную тему */
export const toggleTheme = (current: TThemeName): TThemeName => {
  return current === 'dark' ? 'light' : 'dark';
};

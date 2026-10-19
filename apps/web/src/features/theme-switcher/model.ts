import type { TCssColor, TThemeMode, TUiColorToken } from '@/shared/config';
import { THEME_STORAGE_KEY, uiChrome, uiPalette } from '@/shared/config';

/** Reads the stored theme, defaults to light */
export const readStoredTheme = (): TThemeMode => {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return 'light';
};

/** Toggles the dark class on html, writes CSS variables from the palette and localStorage */
export const applyTheme = (theme: TThemeMode): void => {
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

/** Toggles between light and dark theme */
export const toggleTheme = (current: TThemeMode): TThemeMode => {
  return current === 'dark' ? 'light' : 'dark';
};

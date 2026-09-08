import { beforeEach, describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY, uiChrome, uiPalette } from '@/shared/config';
import { applyTheme, readStoredTheme, toggleTheme } from './model';

describe('theme model', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('style');
  });

  it('defaults via matchMedia when unset', () => {
    expect(readStoredTheme()).toBe('light');
  });

  it('reads a stored theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    expect(readStoredTheme()).toBe('dark');
  });

  it('toggles light and dark', () => {
    expect(toggleTheme('light')).toBe('dark');
    expect(toggleTheme('dark')).toBe('light');
  });

  it('applies palette CSS vars and dark class', () => {
    applyTheme('dark');

    const root = document.documentElement;
    expect(root.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(root.style.getPropertyValue('--fg')).toBe(uiPalette.dark.fg);
    expect(root.style.getPropertyValue('--on-yellow')).toBe(uiChrome.onYellow);
    expect(root.style.getPropertyValue('--finish-wipe-dark')).toBe(uiChrome.finishWipeDark);
  });
});

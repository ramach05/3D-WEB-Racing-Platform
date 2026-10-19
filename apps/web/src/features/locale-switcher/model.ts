import type { TAppLocale } from '@/shared/config';
import { LOCALE_STORAGE_KEY } from '@/shared/config';

/** Reads the stored locale */
export const readStoredLocale = (): TAppLocale => {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'ru' || stored === 'en') {
    return stored;
  }
  return 'en';
};

/** Persists the locale to localStorage */
export const persistLocale = (locale: TAppLocale): void => {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
};

/** Toggles between ru and en */
export const toggleLocale = (current: TAppLocale): TAppLocale => {
  return current === 'ru' ? 'en' : 'ru';
};

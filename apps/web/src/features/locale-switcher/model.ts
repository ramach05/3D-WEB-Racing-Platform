import type { AppLocale } from '@/shared/config';
import { LOCALE_STORAGE_KEY } from '@/shared/config';

/** Читает сохранённый язык */
export const readStoredLocale = (): AppLocale => {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'ru' || stored === 'en') {
    return stored;
  }
  return 'ru';
};

/** Пишет язык в localStorage */
export const persistLocale = (locale: AppLocale): void => {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
};

/** Переключает ru/en */
export const toggleLocale = (current: AppLocale): AppLocale => {
  return current === 'ru' ? 'en' : 'ru';
};

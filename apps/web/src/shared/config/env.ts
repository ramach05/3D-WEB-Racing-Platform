/** Базовый URL Nest API */
export const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
};

export const THEME_STORAGE_KEY = 'racing-theme';
export const LOCALE_STORAGE_KEY = 'racing-locale';
export const AUTH_STORAGE_KEY = 'racing-auth';

export type ThemeName = 'light' | 'dark';
export type AppLocale = 'ru' | 'en';

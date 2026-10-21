/** Base URL of the Nest API */
export const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
};

export const THEME_STORAGE_KEY = 'racing-theme';
export const LOCALE_STORAGE_KEY = 'racing-locale';
/** v4: suv → pickup, resets the stale stored selection */
export const VEHICLE_STORAGE_KEY = 'racing-vehicle-v4';

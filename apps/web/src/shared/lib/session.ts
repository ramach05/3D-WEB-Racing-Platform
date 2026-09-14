import type { TAuthSession } from './session.types';

const LEGACY_AUTH_STORAGE_KEY = 'racing-auth';

let accessTokenMemory: string | null = null;

/** Читает access JWT из памяти (refresh — только httpOnly cookie) */
export const readAuthSession = (): TAuthSession | null => {
  if (!accessTokenMemory) {
    return null;
  }
  return { accessToken: accessTokenMemory };
};

/** Пишет access JWT в память */
export const writeAuthSession = (session: TAuthSession): void => {
  accessTokenMemory = session.accessToken;
};

/** Удаляет access JWT из памяти и старый localStorage-ключ */
export const clearAuthSession = (): void => {
  accessTokenMemory = null;
  try {
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  } catch {
    // SSR / private mode
  }
};

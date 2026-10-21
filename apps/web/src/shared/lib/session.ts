import type { TAuthSession } from './session.types';

const LEGACY_AUTH_STORAGE_KEY = 'racing-auth';

let accessTokenMemory: string | null = null;

/** Reads the access JWT from memory (refresh lives only in the httpOnly cookie) */
export const readAuthSession = (): TAuthSession | null => {
  if (!accessTokenMemory) {
    return null;
  }
  return { accessToken: accessTokenMemory };
};

/** Stores the access JWT in memory */
export const writeAuthSession = (session: TAuthSession): void => {
  accessTokenMemory = session.accessToken;
};

/** Clears the access JWT from memory and removes the legacy localStorage key */
export const clearAuthSession = (): void => {
  accessTokenMemory = null;
  try {
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  } catch {
    // SSR / private mode
  }
};

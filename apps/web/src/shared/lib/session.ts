import { AUTH_STORAGE_KEY } from '@/shared/config';
import type { TAuthSession } from './session.types';

type TStoredSession = {
  /** JWT access из localStorage */
  accessToken?: string;
  /** JWT refresh из localStorage */
  refreshToken?: string;
};

/** Читает JWT из localStorage */
export const readAuthSession = (): TAuthSession | null => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as TStoredSession;
    if (typeof parsed.accessToken === 'string' && typeof parsed.refreshToken === 'string') {
      return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
    }
    return null;
  } catch {
    return null;
  }
};

/** Пишет JWT в localStorage */
export const writeAuthSession = (session: TAuthSession): void => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

/** Удаляет JWT из localStorage */
export const clearAuthSession = (): void => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};

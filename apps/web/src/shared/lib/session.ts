import { AUTH_STORAGE_KEY } from '@/shared/config';

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
};

type StoredSession = {
  accessToken?: string;
  refreshToken?: string;
};

/** Читает JWT из localStorage */
export const readAuthSession = (): AuthSession | null => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (typeof parsed.accessToken === 'string' && typeof parsed.refreshToken === 'string') {
      return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
    }
    return null;
  } catch {
    return null;
  }
};

/** Пишет JWT в localStorage */
export const writeAuthSession = (session: AuthSession): void => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

/** Удаляет JWT из localStorage */
export const clearAuthSession = (): void => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};

import { describe, expect, it } from 'vitest';
import { AUTH_STORAGE_KEY } from '@/shared/config';
import { clearAuthSession, readAuthSession, writeAuthSession } from './session';

describe('auth session storage', () => {
  it('returns null when storage is empty', () => {
    expect(readAuthSession()).toBeNull();
  });

  it('writes and reads a valid session', () => {
    const session = { accessToken: 'access', refreshToken: 'refresh' };

    writeAuthSession(session);

    expect(readAuthSession()).toEqual(session);
    expect(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? '')).toEqual(session);
  });

  it('clears the stored session', () => {
    writeAuthSession({ accessToken: 'a', refreshToken: 'b' });

    clearAuthSession();

    expect(readAuthSession()).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('rejects incomplete or invalid JSON', () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ accessToken: 'only' }));
    expect(readAuthSession()).toBeNull();

    localStorage.setItem(AUTH_STORAGE_KEY, '{broken');
    expect(readAuthSession()).toBeNull();
  });
});

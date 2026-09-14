import { describe, expect, it, beforeEach } from 'vitest';
import { clearAuthSession, readAuthSession, writeAuthSession } from './session';

describe('auth session memory', () => {
  beforeEach(() => {
    clearAuthSession();
    localStorage.clear();
  });

  it('returns null when memory is empty', () => {
    expect(readAuthSession()).toBeNull();
  });

  it('writes and reads access token from memory', () => {
    writeAuthSession({ accessToken: 'access' });

    expect(readAuthSession()).toEqual({ accessToken: 'access' });
  });

  it('clears memory and legacy localStorage key', () => {
    localStorage.setItem('racing-auth', JSON.stringify({ accessToken: 'a', refreshToken: 'b' }));
    writeAuthSession({ accessToken: 'a' });

    clearAuthSession();

    expect(readAuthSession()).toBeNull();
    expect(localStorage.getItem('racing-auth')).toBeNull();
  });
});

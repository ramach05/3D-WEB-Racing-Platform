import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAuthSession, readAuthSession } from '@/shared/lib';
import { authReducer, logout, persistAccessToken, selectUser, setUser } from './model';

const createAuthStore = () =>
  configureStore({
    reducer: { auth: authReducer },
  });

describe('auth model', () => {
  beforeEach(() => {
    clearAuthSession();
    localStorage.clear();
  });

  it('sets and selects user', () => {
    const store = createAuthStore();
    const user = {
      id: '1',
      nickname: 'racer',
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    store.dispatch(setUser(user));

    expect(selectUser(store.getState())).toEqual(user);
  });

  it('persists access token to memory', () => {
    persistAccessToken('access');

    expect(readAuthSession()).toEqual({ accessToken: 'access' });
  });

  it('clears user and session on logout', () => {
    const store = createAuthStore();
    persistAccessToken('access');
    store.dispatch(
      setUser({
        id: '1',
        nickname: 'racer',
        createdAt: '2024-01-01T00:00:00.000Z',
      }),
    );

    store.dispatch(logout());

    expect(selectUser(store.getState())).toBeNull();
    expect(readAuthSession()).toBeNull();
  });
});

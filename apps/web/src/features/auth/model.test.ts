import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it } from 'vitest';
import { AUTH_STORAGE_KEY } from '@/shared/config';
import { authReducer, logout, persistTokens, selectUser, setUser } from './model';

const createAuthStore = () =>
  configureStore({
    reducer: { auth: authReducer },
  });

describe('auth model', () => {
  beforeEach(() => {
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

  it('persists tokens to storage', () => {
    persistTokens('access', 'refresh');

    expect(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? '')).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
  });

  it('clears user and session on logout', () => {
    const store = createAuthStore();
    persistTokens('access', 'refresh');
    store.dispatch(
      setUser({
        id: '1',
        nickname: 'racer',
        createdAt: '2024-01-01T00:00:00.000Z',
      }),
    );

    store.dispatch(logout());

    expect(selectUser(store.getState())).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});

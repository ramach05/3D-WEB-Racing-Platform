import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { TUserPublic } from '@racing/shared';
import { clearAuthSession, writeAuthSession } from '@/shared/lib';
import type { TAuthState } from './model.types';

const initialState: TAuthState = {
  user: null,
};

/**
 * Сессия пользователя в Redux.
 * Access JWT — в памяти (shared/lib/session); refresh — httpOnly cookie.
 */
export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<TUserPublic | null>) => {
      state.user = action.payload;
    },
    logout: (state) => {
      state.user = null;
      clearAuthSession();
    },
  },
});

export const { setUser, logout } = authSlice.actions;
export const authReducer = authSlice.reducer;

type TAuthRoot = {
  /** Слайс авторизации в корневом store */
  auth: TAuthState;
};

/** Текущий пользователь или null */
export const selectUser = (state: TAuthRoot): TUserPublic | null => state.auth.user;

/** Сохраняет access JWT в памяти */
export const persistAccessToken = (accessToken: string): void => {
  writeAuthSession({ accessToken });
};

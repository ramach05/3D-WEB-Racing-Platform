import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { TUserPublic } from '@racing/shared';
import { clearAuthSession, writeAuthSession } from '@/shared/lib';
import type { TAuthState } from './model.types';

const initialState: TAuthState = {
  user: null,
  hydrated: false,
};

/** User session in Redux. Access JWT lives in memory (shared/lib/session); refresh is an httpOnly cookie. */
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
    setHydrated: (state, action: PayloadAction<boolean>) => {
      state.hydrated = action.payload;
    },
  },
});

export const { setUser, logout, setHydrated } = authSlice.actions;
export const authReducer = authSlice.reducer;

type TAuthRoot = {
  /** Auth slice in the root store */
  auth: TAuthState;
};

/** Current user or null */
export const selectUser = (state: TAuthRoot): TUserPublic | null => state.auth.user;

/** Whether session hydration completed at app startup */
export const selectHydrated = (state: TAuthRoot): boolean => state.auth.hydrated;

/** Stores the access JWT in memory */
export const persistAccessToken = (accessToken: string): void => {
  writeAuthSession({ accessToken });
};

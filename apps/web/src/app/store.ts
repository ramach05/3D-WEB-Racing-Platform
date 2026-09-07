import { configureStore } from '@reduxjs/toolkit';
import { authReducer } from '@/features/auth';
import { racingApi } from '@/shared/api';
import '@/entities/leaderboard';
import '@/entities/race-result';
import '@/entities/track';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [racingApi.reducerPath]: racingApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(racingApi.middleware),
});

export type TRootState = ReturnType<typeof store.getState>;
export type TAppDispatch = typeof store.dispatch;

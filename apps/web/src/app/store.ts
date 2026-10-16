import { configureStore } from '@reduxjs/toolkit';
import { authReducer } from '@/features/auth';
import { backendReducer } from '@/features/backend-status';
import { racingApi } from '@/shared/api';
import '@/entities/leaderboard';
import '@/entities/race-result';
import '@/entities/track';

/** Redux store: auth + backend status + RTK Query */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    backend: backendReducer,
    [racingApi.reducerPath]: racingApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(racingApi.middleware),
});

/** Корневой state */
export type TRootState = ReturnType<typeof store.getState>;
/** Тип dispatch */
export type TAppDispatch = typeof store.dispatch;

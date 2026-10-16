import { createSlice } from '@reduxjs/toolkit';
import { useSelector } from 'react-redux';
import { racingApi } from '@/shared/api';

/** Ответ GET /health */
type THealthResponse = { status: 'ok' };

/** Доступность API для стартового гейта */
export type TBackendStatus = 'booting' | 'ready' | 'lost';

/** Интервал опроса, пока первый ответ не получен или связь потеряна */
const BOOT_POLL_MS = 1_500;
/** Редкий heartbeat живого API */
const HEARTBEAT_POLL_MS = 15_000;
/** Неудачных опросов подряд, после которых связь считается потерянной */
const LOST_THRESHOLD = 2;

type TBackendState = {
  /** Первый успешный /health получен */
  everReady: boolean;
  /** Подряд идущие неудачные health-опросы */
  failures: number;
};

const initialState: TBackendState = { everReady: false, failures: 0 };

/** Состояние доступности API; обновляется из жизненного цикла health-запроса */
export const backendSlice = createSlice({
  name: 'backend',
  initialState,
  reducers: {
    healthSucceeded: (state) => {
      state.everReady = true;
      state.failures = 0;
    },
    healthFailed: (state) => {
      state.failures += 1;
    },
  },
});

export const { healthFailed, healthSucceeded } = backendSlice.actions;
export const backendReducer = backendSlice.reducer;

type TBackendRoot = {
  /** Слайс доступности API в корневом store */
  backend: TBackendState;
};

const selectEverReady = (state: TBackendRoot): boolean => state.backend.everReady;
const selectFailures = (state: TBackendRoot): number => state.backend.failures;

/** Опрос /health: итог каждого ответа пишется в слайс backend */
export const backendStatusApi = racingApi.injectEndpoints({
  endpoints: (build) => ({
    getHealth: build.query<THealthResponse, void>({
      query: () => '/health',
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(healthSucceeded());
        } catch {
          dispatch(healthFailed());
        }
      },
    }),
  }),
});

const { useGetHealthQuery } = backendStatusApi;

/**
 * Статус API: 'booting' до первого успешного /health, 'lost' после LOST_THRESHOLD
 * неудачных опросов подряд, иначе 'ready'.
 */
export const useBackendStatus = (): TBackendStatus => {
  const everReady = useSelector(selectEverReady);
  const failures = useSelector(selectFailures);

  useGetHealthQuery(undefined, {
    pollingInterval: !everReady || failures >= LOST_THRESHOLD ? BOOT_POLL_MS : HEARTBEAT_POLL_MS,
  });

  if (!everReady) {
    return 'booting';
  }
  return failures >= LOST_THRESHOLD ? 'lost' : 'ready';
};

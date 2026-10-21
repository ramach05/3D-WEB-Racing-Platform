import { createSlice } from '@reduxjs/toolkit';
import { useSelector } from 'react-redux';
import { racingApi } from '@/shared/api';

/** GET /health response */
type THealthResponse = { status: 'ok' };

/** API availability for the startup gate */
export type TBackendStatus = 'booting' | 'ready' | 'lost';

/** Polling interval until the first response arrives or the connection is lost */
const BOOT_POLL_MS = 1_500;
/** Rare heartbeat while the API is alive */
const HEARTBEAT_POLL_MS = 15_000;
/** Consecutive failed polls after which the connection is considered lost */
const LOST_THRESHOLD = 2;

type TBackendState = {
  /** First successful /health received */
  everReady: boolean;
  /** Consecutive failing health polls */
  failures: number;
};

const initialState: TBackendState = { everReady: false, failures: 0 };

/** API availability state; updated from the health request lifecycle */
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
  /** API availability slice in the root store */
  backend: TBackendState;
};

const selectEverReady = (state: TBackendRoot): boolean => state.backend.everReady;
const selectFailures = (state: TBackendRoot): number => state.backend.failures;

/** Polls /health: each response outcome is written to the backend slice */
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

/** API status: 'booting' until the first successful /health, 'lost' after LOST_THRESHOLD consecutive failed polls, otherwise 'ready'. */
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

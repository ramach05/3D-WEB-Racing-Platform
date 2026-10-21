import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { TRefreshResponse } from '@racing/shared';
import { getApiBaseUrl } from '@/shared/config';
import { clearAuthSession, readAuthSession, writeAuthSession } from '@/shared/lib';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: getApiBaseUrl(),
  credentials: 'include',
  prepareHeaders: (headers) => {
    const session = readAuthSession();
    if (session) {
      headers.set('Authorization', `Bearer ${session.accessToken}`);
    }
    return headers;
  },
});

/** Max GET retries on network failure (backend booting or restarting) */
const NETWORK_RETRIES = 4;
/** Base backoff delay */
const NETWORK_RETRY_BASE_MS = 300;

const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

/** Network failure (server not responding), as opposed to an HTTP error status */
const isNetworkFailure = (result: Awaited<ReturnType<typeof rawBaseQuery>>): boolean => {
  return result.error?.status === 'FETCH_ERROR';
};

/** Retries only GET on network failure with backoff: idempotent requests survive API start/restart, mutations are never re-sent. */
const rawBaseQueryWithRetry: typeof rawBaseQuery = async (args, api, extraOptions) => {
  const method = typeof args === 'string' ? 'GET' : (args.method ?? 'GET');
  const isRetryable = method.toUpperCase() === 'GET';

  for (let attempt = 0; ; attempt += 1) {
    const result = await rawBaseQuery(args, api, extraOptions);
    if (!isRetryable || !isNetworkFailure(result) || attempt >= NETWORK_RETRIES) {
      return result;
    }
    await delay(NETWORK_RETRY_BASE_MS * 2 ** attempt);
  }
};

/** Marker for "own" XHR for refresh/logout: the server requires it as CSRF protection for cookie endpoints */
const CSRF_HEADERS = { 'X-Requested-With': 'XMLHttpRequest' };

/** Raw POST /auth/refresh without deduplication */
const runRefresh = (
  api: Parameters<typeof rawBaseQuery>[1],
  extraOptions: Parameters<typeof rawBaseQuery>[2],
) =>
  rawBaseQuery({ url: '/auth/refresh', method: 'POST', headers: CSRF_HEADERS }, api, extraOptions);

/** Result of a single refresh request (same shape as baseQuery's) */
type TRefreshResult = Awaited<ReturnType<typeof runRefresh>>;

/**
 * Single in-flight refresh: parallel calls yield one HTTP request.
 * The server rotates the refresh token and revokes all sessions on reuse of
 * an old token, so a second parallel refresh would log the user out.
 */
let refreshInFlight: Promise<TRefreshResult> | null = null;

const refreshOnce = (
  api: Parameters<typeof rawBaseQuery>[1],
  extraOptions: Parameters<typeof rawBaseQuery>[2],
): Promise<TRefreshResult> => {
  if (refreshInFlight) {
    return refreshInFlight;
  }
  const inFlight = (async (): Promise<TRefreshResult> => {
    const res = await runRefresh(api, extraOptions);
    if (res.data) {
      writeAuthSession({ accessToken: (res.data as TRefreshResponse).tokens.accessToken });
    }
    return res;
  })().finally(() => {
    if (refreshInFlight === inFlight) {
      refreshInFlight = null;
    }
  });
  refreshInFlight = inFlight;
  return inFlight;
};

/** Repeats the request after refreshing the cookie when the access token expired */
const baseQueryWithReauth: typeof rawBaseQuery = async (args, api, extraOptions) => {
  const url = typeof args === 'string' ? args : args.url;
  const isAuthCall =
    url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/logout');

  // Any refresh (mutation or the reauth below) goes through single-flight
  if (url.includes('/auth/refresh')) {
    return refreshOnce(api, extraOptions);
  }

  const result = await rawBaseQueryWithRetry(args, api, extraOptions);

  if (result.error?.status !== 401 || isAuthCall) {
    return result;
  }

  if (!readAuthSession()) {
    return result;
  }

  const refreshResult = await refreshOnce(api, extraOptions);

  if (refreshResult.data) {
    return rawBaseQuery(args, api, extraOptions);
  }

  clearAuthSession();
  api.dispatch({ type: 'auth/logout' });
  return result;
};

/** Base RTK Query API: slice tags are attached via injectEndpoints */
export const racingApi = createApi({
  reducerPath: 'racingApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Track', 'Leaderboard', 'Me'],
  endpoints: () => ({}),
});

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

/** Сырой POST /auth/refresh без дедупликации */
const runRefresh = (
  api: Parameters<typeof rawBaseQuery>[1],
  extraOptions: Parameters<typeof rawBaseQuery>[2],
) => rawBaseQuery({ url: '/auth/refresh', method: 'POST' }, api, extraOptions);

/** Результат одного refresh-запроса (та же форма, что у baseQuery) */
type TRefreshResult = Awaited<ReturnType<typeof runRefresh>>;

/**
 * Единый in-flight refresh: параллельные вызовы дают один HTTP-запрос.
 * Сервер ротирует refresh-токен и отзывает все сессии при повторном использовании
 * старого токена, поэтому второй параллельный refresh разлогинивал пользователя.
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

/** Повторяет запрос после refresh cookie, если access истёк */
const baseQueryWithReauth: typeof rawBaseQuery = async (args, api, extraOptions) => {
  const url = typeof args === 'string' ? args : args.url;
  const isAuthCall =
    url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/logout');

  // Любой refresh (мутация или reauth ниже) идет через single-flight
  if (url.includes('/auth/refresh')) {
    return refreshOnce(api, extraOptions);
  }

  const result = await rawBaseQuery(args, api, extraOptions);

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

/** Базовый API RTK Query: теги слайсов навешиваются через injectEndpoints */
export const racingApi = createApi({
  reducerPath: 'racingApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Track', 'Leaderboard', 'Me'],
  endpoints: () => ({}),
});

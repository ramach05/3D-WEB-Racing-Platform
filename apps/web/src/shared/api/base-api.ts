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

/** Повторяет запрос после refresh cookie, если access истёк */
const baseQueryWithReauth: typeof rawBaseQuery = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  const url = typeof args === 'string' ? args : args.url;
  const isAuthCall =
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout');

  if (result.error?.status !== 401 || isAuthCall) {
    return result;
  }

  if (!readAuthSession()) {
    return result;
  }

  const refreshResult = await rawBaseQuery(
    { url: '/auth/refresh', method: 'POST' },
    api,
    extraOptions,
  );

  if (refreshResult.data) {
    const data = refreshResult.data as TRefreshResponse;
    writeAuthSession({ accessToken: data.tokens.accessToken });
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

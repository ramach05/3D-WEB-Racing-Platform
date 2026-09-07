import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { TAuthTokens } from '@racing/shared';
import { getApiBaseUrl } from '@/shared/config';
import { clearAuthSession, readAuthSession, writeAuthSession } from '@/shared/lib';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: getApiBaseUrl(),
  prepareHeaders: (headers) => {
    const session = readAuthSession();
    if (session) {
      headers.set('Authorization', `Bearer ${session.accessToken}`);
    }
    return headers;
  },
});

type TRefreshResponse = {
  /** Новая пара JWT после /auth/refresh */
  tokens: TAuthTokens;
};

/** Повторяет запрос после refresh, если access истёк */
const baseQueryWithReauth: typeof rawBaseQuery = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  const url = typeof args === 'string' ? args : args.url;
  const isAuthCall =
    url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh');

  if (result.error?.status !== 401 || isAuthCall) {
    return result;
  }

  const session = readAuthSession();
  if (!session) {
    return result;
  }

  const refreshResult = await rawBaseQuery(
    { url: '/auth/refresh', method: 'POST', body: { refreshToken: session.refreshToken } },
    api,
    extraOptions,
  );

  if (refreshResult.data) {
    const data = refreshResult.data as TRefreshResponse;
    writeAuthSession(data.tokens);
    return rawBaseQuery(args, api, extraOptions);
  }

  clearAuthSession();
  return result;
};

/** Базовый API RTK Query: теги слайсов навешиваются через injectEndpoints */
export const racingApi = createApi({
  reducerPath: 'racingApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Track', 'Leaderboard', 'Me'],
  endpoints: () => ({}),
});

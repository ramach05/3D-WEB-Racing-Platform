import type { AuthResponse, LoginRequest, MeResponse, RegisterRequest } from '@racing/shared';
import { racingApi } from '@/shared/api';
import { persistTokens, logout, setUser } from './model';

export const authApi = racingApi.injectEndpoints({
  endpoints: (build) => ({
    register: build.mutation<AuthResponse, RegisterRequest>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        persistTokens(data.tokens.accessToken, data.tokens.refreshToken);
        dispatch(setUser(data.user));
      },
      invalidatesTags: ['Me'],
    }),
    login: build.mutation<AuthResponse, LoginRequest>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        persistTokens(data.tokens.accessToken, data.tokens.refreshToken);
        dispatch(setUser(data.user));
      },
      invalidatesTags: ['Me'],
    }),
    getMe: build.query<MeResponse, void>({
      query: () => '/auth/me',
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setUser(data.user));
        } catch {
          dispatch(logout());
        }
      },
      providesTags: ['Me'],
    }),
  }),
});

export const { useLoginMutation, useRegisterMutation, useGetMeQuery, useLazyGetMeQuery } = authApi;

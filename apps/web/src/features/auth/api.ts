import type {
  TAuthResponse,
  TLoginRequest,
  TMeResponse,
  TRefreshResponse,
  TRegisterRequest,
} from '@racing/shared';
import { racingApi } from '@/shared/api';
import { persistAccessToken, logout as clearAuth, setUser } from './model';

/** RTK endpoints: register / login / refresh / logout / me */
export const authApi = racingApi.injectEndpoints({
  endpoints: (build) => ({
    register: build.mutation<TAuthResponse, TRegisterRequest>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          persistAccessToken(data.tokens.accessToken);
          dispatch(setUser(data.user));
        } catch {
          return;
        }
      },
      invalidatesTags: ['Me'],
    }),
    login: build.mutation<TAuthResponse, TLoginRequest>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          persistAccessToken(data.tokens.accessToken);
          dispatch(setUser(data.user));
        } catch {
          return;
        }
      },
      invalidatesTags: ['Me'],
    }),
    refreshSession: build.mutation<TRefreshResponse, void>({
      query: () => ({ url: '/auth/refresh', method: 'POST' }),
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          persistAccessToken(data.tokens.accessToken);
        } catch {
          return;
        }
      },
    }),
    logoutSession: build.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch {
          // Локальный выход даже если revoke на сервере не удался
        } finally {
          dispatch(clearAuth());
        }
      },
      invalidatesTags: ['Me'],
    }),
    getMe: build.query<TMeResponse, void>({
      query: () => '/auth/me',
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setUser(data.user));
        } catch {
          dispatch(clearAuth());
        }
      },
      providesTags: ['Me'],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useRefreshSessionMutation,
  useLogoutSessionMutation,
  useGetMeQuery,
  useLazyGetMeQuery,
} = authApi;

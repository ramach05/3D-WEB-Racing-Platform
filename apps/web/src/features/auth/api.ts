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
    refreshSession: build.mutation<TRefreshResponse | undefined, void>({
      query: () => ({ url: '/auth/refresh', method: 'POST' }),
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          // 204 without a cookie arrives with no body: there is nothing to persist
          const { data } = await queryFulfilled;
          if (data) {
            persistAccessToken(data.tokens.accessToken);
          }
        } catch {
          return;
        }
      },
    }),
    logoutSession: build.mutation<void, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        // Clear local state right away without waiting for the response: server-side revoke is best-effort.
        // invalidatesTags is forbidden here — RTK invalidates tags at mutation start, and refetching
        // /auth/me with the old token would resurrect the user after clearAuth.
        dispatch(clearAuth());
        try {
          await queryFulfilled;
        } catch {
          // Local logout even if server-side revoke failed
        }
      },
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

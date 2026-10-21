import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { racingApi } from '@/shared/api';
import { readAuthSession } from '@/shared/lib';
import { useLazyGetMeQuery, useLogoutSessionMutation, useRefreshSessionMutation } from './api';
import { selectHydrated, selectUser, setHydrated } from './model';

/** Hydration: refresh cookie → access in memory → /auth/me; hydrated flips only once the user identity is resolved */
export const AuthHydrator = () => {
  const [refreshSession] = useRefreshSessionMutation();
  const [getMe] = useLazyGetMeQuery();
  const dispatch = useDispatch();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!readAuthSession()) {
          await refreshSession().unwrap();
        }
        if (readAuthSession()) {
          // getMe applies setUser/clearAuth via onQueryStarted before unwrap resolves,
          // so setHydrated(true) below never lands while the user is still unknown (no login/register flash)
          const request = getMe(undefined);
          try {
            await request.unwrap();
          } finally {
            request.unsubscribe();
          }
        }
      } catch {
        // Guest without a cookie / expired session
      } finally {
        if (!cancelled) {
          dispatch(setHydrated(true));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSession, getMe, dispatch]);

  return null;
};

/** Current user from Redux */
export const useAuthUser = () => {
  return useSelector(selectUser);
};

/** Whether initial session hydration finished (before it guest/user status is unknown) */
export const useAuthHydrated = () => {
  return useSelector(selectHydrated);
};

/** Logout: revoke refresh-cookie on the server + local cleanup and request cache reset */
export const useLogout = () => {
  const [logoutSession] = useLogoutSessionMutation();
  const dispatch = useDispatch();

  return useCallback(() => {
    void (async () => {
      await logoutSession();
      // Reset RTK Query cache so a stale cached getMe does not return the user on mount
      dispatch(racingApi.util.resetApiState());
    })();
  }, [logoutSession, dispatch]);
};

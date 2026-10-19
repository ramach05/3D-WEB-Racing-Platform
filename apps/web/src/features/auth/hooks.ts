import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { racingApi } from '@/shared/api';
import { readAuthSession } from '@/shared/lib';
import { useGetMeQuery, useLogoutSessionMutation, useRefreshSessionMutation } from './api';
import { selectHydrated, selectUser, setHydrated } from './model';

/** Hydration: refresh cookie → access in memory → /auth/me */
export const AuthHydrator = () => {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [refreshSession] = useRefreshSessionMutation();
  const dispatch = useDispatch();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!readAuthSession()) {
          await refreshSession().unwrap();
        }
      } catch {
        // Guest without a cookie / expired session
      } finally {
        if (!cancelled) {
          setHasAccess(Boolean(readAuthSession()));
          setBootstrapped(true);
          dispatch(setHydrated(true));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSession, dispatch]);

  useGetMeQuery(undefined, { skip: !bootstrapped || !hasAccess });
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

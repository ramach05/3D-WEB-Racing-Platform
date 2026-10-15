import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { readAuthSession } from '@/shared/lib';
import { useGetMeQuery, useLogoutSessionMutation, useRefreshSessionMutation } from './api';
import { selectHydrated, selectUser, setHydrated } from './model';

/** Гидрация: refresh cookie → access в памяти → /auth/me */
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
        // Гость без cookie / протухшая сессия
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

/** Текущий пользователь из Redux */
export const useAuthUser = () => {
  return useSelector(selectUser);
};

/** Завершена ли стартовая гидрация сессии (до этого гость/пользователь неизвестны) */
export const useAuthHydrated = () => {
  return useSelector(selectHydrated);
};

/** Выход: revoke refresh-cookie на сервере + локальная очистка */
export const useLogout = () => {
  const [logoutSession] = useLogoutSessionMutation();

  return useCallback(() => {
    void logoutSession();
  }, [logoutSession]);
};

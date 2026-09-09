import { useDispatch, useSelector } from 'react-redux';
import { readAuthSession } from '@/shared/lib';
import { useGetMeQuery } from './api';
import { logout, selectUser } from './model';

/** Гидрация сессии: если в localStorage есть токен, тянем /auth/me */
export const AuthHydrator = () => {
  const hasSession = Boolean(readAuthSession());
  useGetMeQuery(undefined, { skip: !hasSession });
  return null;
};

/** Текущий пользователь из Redux */
export const useAuthUser = () => {
  return useSelector(selectUser);
};

/** Выход: чистим store и JWT */
export const useLogout = () => {
  const dispatch = useDispatch();
  return () => {
    dispatch(logout());
  };
};

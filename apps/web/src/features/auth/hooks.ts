import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { readAuthSession } from '@/shared/lib';
import { useLazyGetMeQuery } from './api';
import { logout, selectUser } from './model';

/** Гидрация сессии: если в localStorage есть токен, тянем /auth/me */
export const AuthHydrator = () => {
  const [fetchMe] = useLazyGetMeQuery();

  // После перезагрузки страницы восстанавливаем пользователя по сохранённому JWT
  useEffect(() => {
    const session = readAuthSession();
    if (!session) {
      return;
    }
    void fetchMe();
  }, [fetchMe]);

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

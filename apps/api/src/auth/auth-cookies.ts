import type { CookieOptions, Response } from 'express';
import { REFRESH_TOKEN_TTL_MS } from './auth.types';

export const REFRESH_COOKIE_NAME = 'refresh_token';

/** Опции httpOnly refresh-cookie (path ограничен /auth) */
export const getRefreshCookieOptions = (): CookieOptions => {
  const secure = process.env.COOKIE_SECURE === 'true';
  const sameSiteEnv = process.env.COOKIE_SAME_SITE;
  const sameSite =
    sameSiteEnv === 'strict' || sameSiteEnv === 'none' || sameSiteEnv === 'lax'
      ? sameSiteEnv
      : 'lax';

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/auth',
    maxAge: REFRESH_TOKEN_TTL_MS,
  };
};

/** Ставит opaque refresh в httpOnly cookie */
export const setRefreshCookie = (res: Response, refreshToken: string): void => {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());
};

/** Сбрасывает refresh-cookie */
export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...getRefreshCookieOptions(),
    maxAge: 0,
  });
};

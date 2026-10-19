export type TJwtUser = {
  userId: string;
  nickname: string;
};

export type TJwtPayload = {
  sub: string;
  nickname: string;
};

export const ACCESS_TOKEN_EXPIRES = '15m';
/** TTL opaque refresh-сессии */
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Алгоритм access-токена: фиксируется при подписи и проверке (против alg-confusion) */
export const JWT_ALGORITHM = 'HS256';
export const JWT_ISSUER = 'racing-api';
export const JWT_AUDIENCE = 'racing-web';

/** Мертвые refresh-сессии удаляются спустя сутки после фактического истечения */
export const REFRESH_PURGE_GRACE_MS = 24 * 60 * 60 * 1000;

/** Заголовок-маркер «своего» XHR: обязателен на refresh/logout (защита от CSRF при sameSite=none) */
export const CSRF_HEADER_NAME = 'x-requested-with';

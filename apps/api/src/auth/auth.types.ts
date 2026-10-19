export type TJwtUser = {
  userId: string;
  nickname: string;
};

export type TJwtPayload = {
  sub: string;
  nickname: string;
};

export const ACCESS_TOKEN_EXPIRES = '15m';
/** TTL of the opaque refresh session */
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Access token algorithm: fixed at signing and verification (prevents alg-confusion) */
export const JWT_ALGORITHM = 'HS256';
export const JWT_ISSUER = 'racing-api';
export const JWT_AUDIENCE = 'racing-web';

/** Dead refresh sessions are deleted a day after actual expiry */
export const REFRESH_PURGE_GRACE_MS = 24 * 60 * 60 * 1000;

/** "Own XHR" marker header: required on refresh/logout (CSRF protection when sameSite=none) */
export const CSRF_HEADER_NAME = 'x-requested-with';

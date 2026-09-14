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

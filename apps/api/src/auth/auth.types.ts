export type TJwtUser = {
  userId: string;
  nickname: string;
};

export type TJwtPayload = {
  sub: string;
  nickname: string;
};

export const ACCESS_TOKEN_EXPIRES = '15m';
export const REFRESH_TOKEN_EXPIRES = '7d';

/** Публичный пользователь без секретов */
export type TUserPublic = {
  id: string;
  nickname: string;
  createdAt: string;
};

/** Тело регистрации */
export type TRegisterRequest = {
  nickname: string;
  password: string;
};

/** Тело логина */
export type TLoginRequest = {
  nickname: string;
  password: string;
};

/** Пара JWT */
export type TAuthTokens = {
  accessToken: string;
  refreshToken: string;
};

/** Ответ login/register */
export type TAuthResponse = {
  user: TUserPublic;
  tokens: TAuthTokens;
};

/** Обновление access-токена */
export type TRefreshRequest = {
  refreshToken: string;
};

/** Ответ refresh */
export type TRefreshResponse = {
  tokens: TAuthTokens;
};

/** Лучший результат пользователя по одной трассе */
export type TUserBestResult = {
  trackId: string;
  trackSlug: string;
  trackName: string;
  timeMs: number;
  createdAt: string;
};

/** Профиль текущего пользователя */
export type TMeResponse = {
  user: TUserPublic;
  bestResults: TUserBestResult[];
};

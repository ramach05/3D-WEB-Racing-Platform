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

/** Access JWT в JSON; refresh только в httpOnly cookie */
export type TAuthTokens = {
  accessToken: string;
};

/** Ответ login/register */
export type TAuthResponse = {
  user: TUserPublic;
  tokens: TAuthTokens;
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

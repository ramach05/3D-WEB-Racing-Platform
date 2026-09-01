/** Публичный пользователь без секретов */
export type UserPublic = {
  id: string;
  nickname: string;
  createdAt: string;
};

/** Тело регистрации */
export type RegisterRequest = {
  nickname: string;
  password: string;
};

/** Тело логина */
export type LoginRequest = {
  nickname: string;
  password: string;
};

/** Пара JWT */
export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

/** Ответ login/register */
export type AuthResponse = {
  user: UserPublic;
  tokens: AuthTokens;
};

/** Обновление access-токена */
export type RefreshRequest = {
  refreshToken: string;
};

/** Ответ refresh */
export type RefreshResponse = {
  tokens: AuthTokens;
};

/** Лучший результат пользователя по одной трассе */
export type UserBestResult = {
  trackId: string;
  trackSlug: string;
  trackName: string;
  timeMs: number;
  createdAt: string;
};

/** Профиль текущего пользователя */
export type MeResponse = {
  user: UserPublic;
  bestResults: UserBestResult[];
};

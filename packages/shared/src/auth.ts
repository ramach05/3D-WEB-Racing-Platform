/** Public user without secrets */
export type TUserPublic = {
  id: string;
  nickname: string;
  createdAt: string;
};

/** Register request body */
export type TRegisterRequest = {
  nickname: string;
  password: string;
};

/** Login request body */
export type TLoginRequest = {
  nickname: string;
  password: string;
};

/** Access JWT in JSON; refresh goes in an httpOnly cookie only */
export type TAuthTokens = {
  accessToken: string;
};

/** Login/register response */
export type TAuthResponse = {
  user: TUserPublic;
  tokens: TAuthTokens;
};

/** Refresh response */
export type TRefreshResponse = {
  tokens: TAuthTokens;
};

/** Best user result on a single track */
export type TUserBestResult = {
  trackId: string;
  trackSlug: string;
  trackName: string;
  timeMs: number;
  createdAt: string;
};

/** Current user profile */
export type TMeResponse = {
  user: TUserPublic;
  bestResults: TUserBestResult[];
};

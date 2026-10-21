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

/** Aggregated per-track stats of a single user */
export type TUserTrackStat = {
  trackId: string;
  trackSlug: string;
  trackName: string;
  /** Finished races on this track */
  races: number;
  bestTimeMs: number;
  /** Sum of all finish times on this track (sums up into TUserStats.totalTimeMs) */
  totalTimeMs: number;
  /** Place among all players of this track (1-based, one best result per user) */
  rank: number;
  /** Gap from the user's best to the track leader (0 when the user is the leader) */
  gapToLeaderMs: number;
  /** How much the best result improved compared to the first finish (>= 0) */
  improvementMs: number;
};

/** Aggregated profile stats over all race results of a user */
export type TUserStats = {
  totalRaces: number;
  /** Distinct tracks with at least one finish */
  tracksCompleted: number;
  /** Sum of all finish times */
  totalTimeMs: number;
  firstRaceAt: string | null;
  lastRaceAt: string | null;
  perTrack: TUserTrackStat[];
};

/** Current user profile */
export type TMeResponse = {
  user: TUserPublic;
  bestResults: TUserBestResult[];
  stats: TUserStats;
};

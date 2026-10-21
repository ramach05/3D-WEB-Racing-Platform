/** A saved race result */
export type TRaceResultPublic = {
  id: string;
  timeMs: number;
  userId: string;
  trackId: string;
  createdAt: string;
};

/** Creating a result after the finish */
export type TCreateRaceResultRequest = {
  trackId: string;
  timeMs: number;
};

/** Lower time bound: filters out instant-finish cheats */
export const RACE_TIME_MIN_MS = 8_000;

/** Upper bound: races longer than 15 minutes are rejected */
export const RACE_TIME_MAX_MS = 15 * 60 * 1000;

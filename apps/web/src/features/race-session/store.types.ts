export type TRaceStatus = 'ready' | 'countdown' | 'racing' | 'finished' | 'paused';

/** Countdown step: 3→2→1→0(GO), null outside countdown */
export type TCountdownStep = 3 | 2 | 1 | 0;

export type TRaceHudSnapshot = {
  /** Current race time, ms */
  timeMs: number;
  /** Guest's best time on the track, ms */
  bestMs: number | null;
  /** Race phase */
  status: TRaceStatus;
  /** Active 3-2-1-GO step during countdown */
  countdownStep: TCountdownStep | null;
  /** Vehicle speed, km/h */
  speedKmh: number;
  /** Index of the next checkpoint */
  checkpointIndex: number;
  /** Number of checkpoints per lap */
  checkpointTotal: number;
  /** 0-based index of the current lap */
  lapIndex: number;
  /** Total laps in the race */
  lapTotal: number;
};

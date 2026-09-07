export type TRaceStatus = 'ready' | 'countdown' | 'racing' | 'finished' | 'paused';

/** Шаг отсчёта: 3→2→1→0(GO), null вне countdown */
export type TCountdownStep = 3 | 2 | 1 | 0;

export type TRaceHudSnapshot = {
  timeMs: number;
  bestMs: number | null;
  status: TRaceStatus;
  /** Активный шаг 3-2-1-GO во время countdown */
  countdownStep: TCountdownStep | null;
  speedKmh: number;
  checkpointIndex: number;
  checkpointTotal: number;
  /** 0-based индекс текущего круга */
  lapIndex: number;
  lapTotal: number;
};

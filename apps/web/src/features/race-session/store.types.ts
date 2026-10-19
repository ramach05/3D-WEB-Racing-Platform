export type TRaceStatus = 'ready' | 'countdown' | 'racing' | 'finished' | 'paused';

/** Шаг отсчета: 3→2→1→0(GO), null вне countdown */
export type TCountdownStep = 3 | 2 | 1 | 0;

export type TRaceHudSnapshot = {
  /** Время текущего заезда, мс */
  timeMs: number;
  /** Лучшее время гостя на трассе, мс */
  bestMs: number | null;
  /** Фаза заезда */
  status: TRaceStatus;
  /** Активный шаг 3-2-1-GO во время countdown */
  countdownStep: TCountdownStep | null;
  /** Скорость машины, км/ч */
  speedKmh: number;
  /** Индекс следующего чекпоинта */
  checkpointIndex: number;
  /** Число чекпоинтов на круге */
  checkpointTotal: number;
  /** 0-based индекс текущего круга */
  lapIndex: number;
  /** Всего кругов в заезде */
  lapTotal: number;
};

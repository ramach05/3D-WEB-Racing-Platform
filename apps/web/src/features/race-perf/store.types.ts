export type TRacePerfSnapshot = {
  /** Кадры в секунду за окно выборки */
  fps: number;
  /** Доля времени кадра от wall-time, % */
  cpuPercent: number;
  /** JS-куча в МБ (Chrome); null без performance.memory */
  memMb: number | null;
};

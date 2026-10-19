export type TRacePerfSnapshot = {
  /** Frames per second over the sampling window */
  fps: number;
  /** Frame work time share of wall time, % */
  cpuPercent: number;
  /** JS heap in MB (Chrome); null without performance.memory */
  memMb: number | null;
};

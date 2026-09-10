import type { TCountdownStep, TRaceStatus } from '@/features/race-session';

export const START_LAMP_COUNT = 5;

/** Геометрия F1-gantry — визуал и коллайдеры из одних чисел */
export const GANTRY_ROAD_TOP_Y = 0.1;
export const GANTRY_POST_OUTSET = 0.55;
export const GANTRY_POST_WIDTH = 0.28;
export const GANTRY_POST_DEPTH = 0.28;
export const GANTRY_BEAM_CLEARANCE_Y = 4.6;
export const GANTRY_BEAM_HEIGHT = 0.28;
export const GANTRY_BEAM_DEPTH = 0.36;
export const GANTRY_PANEL_WIDTH = 3.6;
export const GANTRY_PANEL_HEIGHT = 0.85;
export const GANTRY_PANEL_DEPTH = 0.28;

/** Сколько крайних ламп горят на шаге countdown (3→2→1); 0 = все гаснут (GO) */
const LIT_BY_COUNTDOWN_STEP: Record<TCountdownStep, number> = {
  3: 2,
  2: 4,
  1: 5,
  0: 0,
};

/** Число горящих крайних ламп по HUD-статусу (симметрично от краёв к центру). */
export const litCountForHud = (
  status: TRaceStatus,
  countdownStep: TCountdownStep | null,
): number => {
  if (status === 'countdown' && countdownStep !== null) {
    return LIT_BY_COUNTDOWN_STEP[countdownStep];
  }
  return 0;
};

/** Лампа index (0..n-1) горит, если litCount крайних включены. */
export const isLampLit = (
  index: number,
  litCount: number,
  lampCount = START_LAMP_COUNT,
): boolean => {
  if (litCount <= 0) {
    return false;
  }
  if (litCount >= lampCount) {
    return true;
  }
  const half = Math.floor(litCount / 2);
  return index < half || index >= lampCount - half;
};

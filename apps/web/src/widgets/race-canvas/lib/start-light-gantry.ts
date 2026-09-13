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

/**
 * Stadium-прожекторы на столбах gantry (Night City).
 * 4 корпуса: ±пост × ±сторона линии; aim на асфальт у спавна / финишного проезда.
 */
export const GANTRY_FLOOD = {
  /** Опускание корпуса от центра балки */
  housingDropY: 0.32,
  /** Сдвиг корпуса от оси столба к полотну */
  housingInsetX: 0.12,
  /** Вынос корпуса от балки по |Z| */
  housingOutsetZ: 0.48,
  housing: {
    width: 0.2,
    height: 0.12,
    depth: 0.26,
  },
  bulbRadius: 0.045,
  /** Aim |Z| на асфальте от линии */
  aimZ: 4.2,
  /** Aim |X| как доля half-roadWidth */
  aimXFraction: 0.28,
  /** Emissive линзы под Bloom */
  lensEmissiveIntensity: 1.5,
} as const;

/** SpotLight: мягкая заливка полотна у линии (без shadow map) */
export const GANTRY_FLOOD_SPOT = {
  intensity: 55,
  distance: 20,
  /** ~49° — пятно ~половины полосы с высоты балки */
  angle: 0.85,
  penumbra: 0.92,
  decay: 2,
} as const;

/** PointLight spill у столбов (2 шт. — левый/правый) */
export const GANTRY_FLOOD_POINT = {
  intensity: 3.2,
  distance: 12,
  decay: 2,
} as const;

/** sideX/sideZ: знаки поста и стороны линии (+Z = спавн) */
export const GANTRY_FLOOD_PLACEMENTS = [
  { sideX: -1, sideZ: 1 },
  { sideX: 1, sideZ: 1 },
  { sideX: -1, sideZ: -1 },
  { sideX: 1, sideZ: -1 },
] as const;

/** Сколько крайних ламп горят на шаге countdown (3→2→1); 0 = все гаснут (GO) */
const LIT_BY_COUNTDOWN_STEP: Record<TCountdownStep, number> = {
  3: 2,
  2: 4,
  1: 5,
  0: 0,
};

/** Полный цикл мигания финишных огней (с): 0.5 on + 0.5 off */
export const FINISH_LAMP_BLINK_PERIOD_S = 1;

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

/**
 * Square-wave мигание финишных огней (~1 Гц, 50% duty).
 * Без sin — как у реальных реле/светофоров.
 */
export const isFinishLampBlinkOn = (
  elapsedSeconds: number,
  periodS = FINISH_LAMP_BLINK_PERIOD_S,
): boolean => {
  if (periodS <= 0) {
    return false;
  }
  const phase = ((elapsedSeconds % periodS) + periodS) % periodS;
  return phase < periodS / 2;
};

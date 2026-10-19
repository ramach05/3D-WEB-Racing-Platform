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

/** Геометрия одной F1 lamp bay (козырек, ниша, bezel, диск линзы). Коллайдеры панели не меняются — только визуал. */
export const START_LAMP_BAY = {
  /** Радиус светящегося диска линзы */
  lensRadius: 0.2,
  /** Внешний радиус металлического кольца */
  bezelOuterRadius: 0.255,
  /** Глубина кольца по Z */
  bezelDepth: 0.055,
  /** Глубина темной ниши в корпусе */
  recessDepth: 0.07,
  /** Радиус ниши (чуть больше bezel) */
  recessRadius: 0.27,
  /** Шаг между центрами ламп по X */
  spacing: 0.62,
  /** Вынос лицевой плоскости от передней грани панели */
  faceOutset: 0.02,
  hood: {
    width: 0.52,
    height: 0.06,
    depth: 0.22,
    /** Смещение центра козырька вверх от центра линзы */
    offsetY: 0.28,
    /** Вынос козырька вперед от плоскости линзы */
    offsetZ: 0.08,
  },
  /** Emissive выключенной линзы (еле видимая LED-сетка) */
  idleEmissiveIntensity: 0.08,
  /** Emissive включенной линзы — ярко днем без Bloom */
  litEmissiveIntensity: 6.5,
} as const;

/**
 * Stadium-прожекторы на столбах gantry (Night City).
 * Крепление на внутренней грани столба: пластина → кронштейн → корпус.
 * 2 шт. (лево/право); aim — на линию финиша; Spot из линзы.
 * Важно: Group.lookAt направляет +Z на цель (не −Z, как у Camera).
 */
export const GANTRY_FLOOD = {
  /** Опускание узла крепления от центра балки (под низом балки) */
  mountDropY: 0.22,
  /** Смещение пластины по |Z| от оси столба (чуть к спавну) */
  mountZOffset: 0.03,
  /** Пластина на внутренней грани столба (к полотну) */
  mountPlate: {
    width: 0.08,
    height: 0.1,
    depth: 0.025,
  },
  /** Короткий кронштейн к полотну */
  arm: {
    radius: 0.012,
    length: 0.12,
  },
  /** Вилка (yoke) на конце кронштейна */
  yoke: {
    width: 0.07,
    height: 0.032,
    depth: 0.028,
  },
  /** Компактный корпус прожектора */
  housing: {
    width: 0.11,
    height: 0.065,
    depth: 0.13,
  },
  /** Козырек над линзой */
  hood: {
    width: 0.12,
    height: 0.014,
    depth: 0.07,
    offsetY: 0.032,
    offsetZ: 0.02,
  },
  /** Линза / Spot на передней грани (+Z после Group.lookAt). Диск, не сфера — свечение только со стороны трассы. */
  lens: {
    localY: -0.005,
    localZ: 0.068,
    radius: 0.026,
  },
  /** Aim |Z| на линии финиша (шахматка ≈ 0) */
  aimZ: 0.08,
  /** Aim |X| — середина своей половины полотна */
  aimXFraction: 0.22,
  /** Emissive линзы под Bloom */
  lensEmissiveIntensity: 1.6,
} as const;

/** SpotLight: пятно на линии финиша */
export const GANTRY_FLOOD_SPOT = {
  intensity: 85,
  distance: 18,
  /** ~35° — компактное пятно на шахматку */
  angle: 0.62,
  penumbra: 0.75,
  decay: 2,
} as const;

/**
 * Spill у столбов убран — засвечивал столб вместо трассы.
 * @deprecated
 */
export const GANTRY_FLOOD_POINT = {
  intensity: 0,
  distance: 12,
  decay: 2,
} as const;

/** 2 прожектора: левый/правый столб */
export const GANTRY_FLOOD_PLACEMENTS = [
  { sideX: -1, sideZ: 1 },
  { sideX: 1, sideZ: 1 },
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

/** Число горящих крайних ламп по HUD-статусу (симметрично от краев к центру). */
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

/** Square-wave мигание финишных огней (~1 Гц, 50% duty). Без sin — как у реальных реле/светофоров. */
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

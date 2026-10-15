import {
  ROW_DEPTH,
  SECTION_PITCH,
  SECTION_WIDTH,
  TRIBUNE_ROWS,
  canopyUndersideY,
  rowTopY,
  tribuneRowCenterX,
} from '@/entities/track';

/**
 * Stadium-прожекторы на краях крыши (визуал всегда; SpotLight только ночью).
 * Без shadow map; неон рядов — отдельно.
 */
export const TRIBUNE_FLOOD = {
  /** Опускание корпуса от нижней грани навеса */
  housingDropY: 0.12,
  /** Доля глубины трибуны от внутреннего края */
  housingDepthFraction: 0.35,
  housing: {
    width: 0.22,
    height: 0.1,
    depth: 0.28,
  },
  bulbRadius: 0.04,
  /** Emissive линзы под Bloom */
  lensEmissiveIntensity: 1.35,
} as const;

/**
 * Два SpotLight на ±Z краях крыши, вниз на зрителей.
 * Бюджет: ровно 2 источника на всю трибуну, castShadow=false.
 */
export const TRIBUNE_EDGE_SPOT = {
  intensity: 42,
  distance: 14,
  /** Широкий конус — половина грандстенда */
  angle: 0.95,
  penumbra: 0.9,
  decay: 2,
  /** |Z| от центра: край внешней секции с небольшим inset */
  zInset: 1.15,
  /** Aim Z как доля edge Z (внутрь к центру) */
  aimZFraction: 0.32,
  /** Ряд aim (0-based) */
  aimRow: 2,
  /** Высота aim над рядом */
  aimYOffset: 0.45,
} as const;

/** ± края крыши вдоль зала */
export const TRIBUNE_EDGE_Z_SIGNS = [-1, 1] as const;

/**
 * Запечённая заливка толпы — слабее, чем раньше: основной свет от edge Spot.
 */
export const TRIBUNE_CROWD_WASH = {
  color: [1, 0.94, 0.82] as const,
  shirtAdd: 0.18,
  skinAdd: 0.1,
  shirtEmissive: 0.12,
  skinEmissive: 0.06,
  neonBounce: 0.06,
} as const;

/** Глубина площадки рядов по X */
export const tribuneDepthX = () => TRIBUNE_ROWS * ROW_DEPTH;

/** Полупролёт трибуны по Z (от центра до внешнего торца секции) */
export const tribuneHalfSpanZ = () => SECTION_PITCH + SECTION_WIDTH / 2;

/** Локальный X корпуса / Spot на краю крыши */
export const tribuneEdgeLightX = (tribuneInnerX: number, sideSign: number): number =>
  tribuneInnerX + sideSign * tribuneDepthX() * TRIBUNE_FLOOD.housingDepthFraction;

/** Локальный Y под навесом */
export const tribuneEdgeLightY = (): number => canopyUndersideY() - TRIBUNE_FLOOD.housingDropY;

/** Локальный Z края крыши */
export const tribuneEdgeLightZ = (zSign: number): number =>
  zSign * (tribuneHalfSpanZ() - TRIBUNE_EDGE_SPOT.zInset);

/** Aim X — средний ряд */
export const tribuneEdgeAimX = (tribuneInnerX: number, sideSign: number): number =>
  tribuneRowCenterX(tribuneInnerX, sideSign, TRIBUNE_EDGE_SPOT.aimRow);

/** Aim Y — торс зрителя */
export const tribuneEdgeAimY = (): number =>
  rowTopY(TRIBUNE_EDGE_SPOT.aimRow) + TRIBUNE_EDGE_SPOT.aimYOffset;

/** Aim Z — внутрь от края к центру зала */
export const tribuneEdgeAimZ = (zSign: number): number =>
  tribuneEdgeLightZ(zSign) * TRIBUNE_EDGE_SPOT.aimZFraction;

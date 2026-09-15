/** Геометрия придорожного рекламного щита — визуал и коллайдеры из одних чисел */

/** Верх асфальта / земли */
export const BILLBOARD_ROAD_TOP_Y = 0.1;

/** Ширина панели (вдоль трассы, локальный Z) */
export const BILLBOARD_PANEL_WIDTH = 4.6;
/** Высота панели */
export const BILLBOARD_PANEL_HEIGHT = 2.4;
/** Толщина панели (короб бумажного щита) */
export const BILLBOARD_PANEL_DEPTH = 0.14;

/** Ширина рамы вокруг панели */
export const BILLBOARD_FRAME_THICKNESS = 0.12;
/** Глубина рамы (короб) */
export const BILLBOARD_FRAME_DEPTH = 0.22;

/** Сечение столба [width, depth] */
export const BILLBOARD_POST = {
  width: 0.16,
  depth: 0.16,
} as const;

/** Высота столбов от земли до верха рамы */
export const BILLBOARD_POST_HEIGHT =
  BILLBOARD_ROAD_TOP_Y + 1.35 + BILLBOARD_PANEL_HEIGHT + BILLBOARD_FRAME_THICKNESS * 2;

/** Y низа панели (над землёй) */
export const BILLBOARD_PANEL_BOTTOM_Y = BILLBOARD_ROAD_TOP_Y + 1.35;

/** Y центра панели */
export const BILLBOARD_PANEL_CENTER_Y = BILLBOARD_PANEL_BOTTOM_Y + BILLBOARD_PANEL_HEIGHT / 2;

/** Полуширина между центрами столбов */
export const BILLBOARD_POST_HALF_SPAN =
  BILLBOARD_PANEL_WIDTH / 2 + BILLBOARD_FRAME_THICKNESS + BILLBOARD_POST.width * 0.15;

/** Смещение панели вперёд (лицо панели, локальный +X) */
export const BILLBOARD_PANEL_FORWARD_X = BILLBOARD_POST.depth / 2 + BILLBOARD_PANEL_DEPTH / 2 + 0.02;

/** Y верха рамы */
export const BILLBOARD_FRAME_TOP_Y =
  BILLBOARD_PANEL_CENTER_Y + BILLBOARD_PANEL_HEIGHT / 2 + BILLBOARD_FRAME_THICKNESS;

/**
 * Две gooseneck-лампы сверху: цельная сборка крепление → стойка → вылет → шея → корпус.
 * Локально: +X — нормаль лица, Z — вдоль ширины щита.
 * Вылет длиннее, чтобы корпус стоял ~0.7–0.9 м перед лицом (как трековые flood).
 */
export const BILLBOARD_FLOOD = {
  /** Смещение ламп от центра по Z (~четверти панели) */
  zSpan: BILLBOARD_PANEL_WIDTH * 0.28,
  /** Плита крепления на верхней раме [depthX, heightY, widthZ] */
  mount: {
    depth: 0.14,
    height: 0.05,
    width: 0.14,
  },
  /** Высота вертикальной стойки над рамой */
  riserHeight: 0.18,
  /** Длина основного вылета вперёд */
  armLength: 1.05,
  /** Наклон вылета вниз (рад), от горизонтали */
  armPitch: 0.28,
  /** Короткая шея к корпусу */
  neckLength: 0.28,
  /** Доп. наклон шеи вниз относительно вылета */
  neckPitch: 0.72,
  /** Толщина трубы кронштейна */
  armRadius: 0.034,
  /** Корпус прожектора [w, h, d] */
  housing: {
    width: 0.16,
    height: 0.11,
    depth: 0.2,
  },
  /** Радиус «колбы» */
  bulbRadius: 0.038,
} as const;

/**
 * Позиция корпуса gooseneck в корне FloodLight (для визуала).
 * X — вынос перед лицом, Y — чуть выше рамы.
 */
export const BILLBOARD_FLOOD_LIGHT_LOCAL = {
  x: 0.82,
  y: 0.06,
  z: 0,
} as const;

/**
 * Мягкая заливка лица через RectAreaLight (без конусных «кругов» SpotLight).
 * Один area-wash на щит — как рассеянный свет от пары flood на треке.
 */
export const BILLBOARD_FACE_WASH = {
  /** Вынос источника перед лицом панели */
  standoff: 0.9,
  width: BILLBOARD_PANEL_WIDTH * 0.9,
  height: BILLBOARD_PANEL_HEIGHT * 0.82,
  intensity: 2.8,
} as const;

/**
 * Бюджет Night City: RectAreaLight только у K ближайших щитов.
 * Дальние — слабый emissive-fallback лица.
 */
export const BILLBOARD_ACTIVE_WASH = {
  /** Сколько RectAreaLight монтировать одновременно */
  count: 2,
  /** Держать прежний wash, пока щит не дальше K-го + hysteresis (м) */
  switchHysteresis: 10,
} as const;

/**
 * Ночные emissive: колба всегда; лицо — только fallback без активного wash.
 */
export const BILLBOARD_NIGHT_FACE = {
  /** EmissiveIntensity лица у дальних щитов (без RectAreaLight) */
  faceEmissiveFallback: 0.18,
  /** EmissiveIntensity колбы flood (bloom) */
  bulbEmissive: 1.4,
} as const;

/** @deprecated Оставлен для совместимости тестов; лицо заливает BILLBOARD_FACE_WASH */
export const BILLBOARD_FLOOD_SPOT = {
  intensity: 6.5,
  distance: 6.5,
  angle: 1.08,
  penumbra: 1,
  decay: 1.85,
} as const;

/** Локальный spill у колбы — не используется на лице щита */
export const BILLBOARD_FLOOD_FILL = {
  intensity: 0.35,
  distance: 1.8,
  decay: 2,
} as const;

/** Half-extents коллайдеров */
export const BILLBOARD_COLLIDER = {
  post: {
    halfWidth: BILLBOARD_POST.width * 0.6,
    halfHeight: BILLBOARD_POST_HEIGHT / 2,
    halfDepth: BILLBOARD_POST.depth * 0.6,
  },
  panel: {
    halfWidth: BILLBOARD_PANEL_DEPTH * 0.9 + BILLBOARD_FRAME_DEPTH * 0.35,
    halfHeight: (BILLBOARD_PANEL_HEIGHT + BILLBOARD_FRAME_THICKNESS * 2) / 2,
    halfDepth: (BILLBOARD_PANEL_WIDTH + BILLBOARD_FRAME_THICKNESS * 2) / 2,
  },
} as const;

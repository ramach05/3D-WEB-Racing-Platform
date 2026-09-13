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
 */
export const BILLBOARD_FLOOD = {
  /** Смещение ламп от центра по Z */
  zSpan: BILLBOARD_PANEL_WIDTH * 0.26,
  /** Плита крепления на верхней раме [depthX, heightY, widthZ] */
  mount: {
    depth: 0.14,
    height: 0.05,
    width: 0.14,
  },
  /** Высота вертикальной стойки над рамой */
  riserHeight: 0.16,
  /** Длина основного вылета вперёд */
  armLength: 0.92,
  /** Наклон вылета вниз (рад), от горизонтали */
  armPitch: 0.32,
  /** Короткая шея к корпусу */
  neckLength: 0.3,
  /** Доп. наклон шеи вниз относительно вылета */
  neckPitch: 0.95,
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
 * Мягкая заливающая подсветка лица (как flood у трек-сайд щитов).
 * Широкий угол + высокий penumbra, оба спота целятся в центр панели.
 */
export const BILLBOARD_FLOOD_SPOT = {
  intensity: 16,
  distance: 9,
  /** ~55° — конусы сильно перекрываются */
  angle: 0.96,
  penumbra: 0.95,
  decay: 1.35,
} as const;

/** Слабый fill PointLight у колбы — убирает «дыры» между пятнами */
export const BILLBOARD_FLOOD_FILL = {
  intensity: 3.2,
  distance: 5.5,
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

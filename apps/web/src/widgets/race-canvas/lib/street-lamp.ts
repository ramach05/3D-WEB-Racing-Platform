/** Геометрия уличного фонаря — визуал и коллайдеры из одних чисел */

/** Верх асфальта (как у gantry) */
export const STREET_LAMP_ROAD_TOP_Y = 0.1;

/** Высота столба до кронштейна */
export const STREET_LAMP_POLE_HEIGHT = 6.5;
/** Радиус столба */
export const STREET_LAMP_POLE_RADIUS = 0.09;
/** Сегменты цилиндра столба */
export const STREET_LAMP_POLE_SEGMENTS = 8;

/** Горизонтальный вылет кронштейна к дороге */
export const STREET_LAMP_ARM_REACH = 1.85;
/** Толщина трубы кронштейна */
export const STREET_LAMP_ARM_RADIUS = 0.055;
/** Высота изгиба кронштейна над верхом столба */
export const STREET_LAMP_ARM_RISE = 0.35;

/** Корпус плафона [width, height, depth] */
export const STREET_LAMP_HOUSING = {
  width: 0.55,
  height: 0.14,
  depth: 0.32,
} as const;

/** Линза под корпусом */
export const STREET_LAMP_LENS = {
  width: 0.42,
  height: 0.04,
  depth: 0.24,
} as const;

/** Y центра плафона (над асфальтом) */
export const STREET_LAMP_LUMINAIRE_Y =
  STREET_LAMP_ROAD_TOP_Y + STREET_LAMP_POLE_HEIGHT + STREET_LAMP_ARM_RISE * 0.35;

/** Локальный X плафона (к дороге) */
export const STREET_LAMP_LUMINAIRE_LOCAL_X = STREET_LAMP_ARM_REACH;

/**
 * Aim SpotLight на асфальт (локальный X от плафона дальше к полосе).
 * Реальные cobra-head льют основное пятно на проезжую часть, не под столб.
 */
export const STREET_LAMP_SPOT_AIM_LOCAL_X = STREET_LAMP_LUMINAIRE_LOCAL_X + 3.4;

/**
 * SpotLight: яркий LED-конус на дорогу.
 * При шаге ~44 м пятна должны почти смыкаться; intensity сопоставима с фарами машины.
 */
export const STREET_LAMP_SPOT = {
  intensity: 110,
  distance: 30,
  /** ~42° — широкий дорожный Type-III пул */
  angle: 0.72,
  penumbra: 0.88,
  decay: 2,
} as const;

/** PointLight: spill на столб, стену и ближний асфальт */
export const STREET_LAMP_POINT = {
  intensity: 4.2,
  distance: 14,
  decay: 2,
} as const;

/** Emissive линзы под Bloom */
export const STREET_LAMP_LENS_EMISSIVE_INTENSITY = 2.4;

/** Half-extents cuboid-коллайдера столба */
export const STREET_LAMP_COLLIDER = {
  halfWidth: STREET_LAMP_POLE_RADIUS * 1.15,
  halfHeight: STREET_LAMP_POLE_HEIGHT / 2,
  halfDepth: STREET_LAMP_POLE_RADIUS * 1.15,
} as const;

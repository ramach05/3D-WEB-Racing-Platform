/**
 * Общие размеры деревьев: визуал и коллайдеры импортируют отсюда.
 * Единицы — локальные до per-tree scale.
 */

/** Нижний радиус ствола (у земли, шире) */
export const TRUNK_RADIUS_BOTTOM = 0.3;
/** Верхний радиус ствола / радиус коллайдера ствола */
export const TRUNK_RADIUS = 0.14;
/** Высота ствола */
export const TRUNK_HEIGHT = 2.85;
/** Центр ствола по Y */
export const TRUNK_LOCAL_Y = TRUNK_HEIGHT / 2;
/** Сегменты цилиндра ствола */
export const TRUNK_SEGMENTS = 8;

/** Множители scale ствола по виду (один cylinder geometry) */
export const TRUNK_KIND_SCALE = {
  pine: { xz: 0.92, y: 1.12 },
  broadleaf: { xz: 1.12, y: 0.88 },
} as const;

/** Ярус кроны сосны */
export type TPineTier = {
  /** Радиус основания конуса */
  radius: number;
  /** Высота конуса */
  height: number;
  /** Центр конуса по Y */
  localY: number;
  /** Кастить тень (только крупнейший) */
  castShadow: boolean;
  /** Ключ tint в палитре */
  tint: 'pineDark' | 'pine' | 'pineLight';
};

/** Три яруса сосны: низ широкий → верх узкий */
export const PINE_TIERS: readonly TPineTier[] = [
  { radius: 1.55, height: 2.05, localY: 3.15, castShadow: true, tint: 'pineDark' },
  { radius: 1.12, height: 1.85, localY: 4.45, castShadow: false, tint: 'pine' },
  { radius: 0.68, height: 1.55, localY: 5.65, castShadow: false, tint: 'pineLight' },
];

/** Аппроксимация кроны сосны для коллайдера */
export const PINE_CROWN_RADIUS = PINE_TIERS[0]!.radius;
export const PINE_CROWN_HEIGHT =
  PINE_TIERS[2]!.localY +
  PINE_TIERS[2]!.height / 2 -
  (PINE_TIERS[0]!.localY - PINE_TIERS[0]!.height / 2);
export const PINE_CROWN_LOCAL_Y =
  (PINE_TIERS[0]!.localY -
    PINE_TIERS[0]!.height / 2 +
    PINE_TIERS[2]!.localY +
    PINE_TIERS[2]!.height / 2) /
  2;

/** Доля кроны лиственного */
export type TBroadleafLobe = {
  /** Радиус сферы до неравномерного scale */
  radius: number;
  /** Центр относительно основания дерева */
  offset: readonly [number, number, number];
  /** Неравномерный scale → эллипсоид */
  scale: readonly [number, number, number];
  /** Кастить тень */
  castShadow: boolean;
  /** Ключ tint */
  tint: 'broadleaf' | 'broadleafLight';
};

/** 4 overlapping lobes неправильной кроны */
export const BROADLEAF_LOBES: readonly TBroadleafLobe[] = [
  {
    radius: 1.45,
    offset: [0, 3.55, 0],
    scale: [1.18, 0.82, 1.12],
    castShadow: true,
    tint: 'broadleaf',
  },
  {
    radius: 1.05,
    offset: [0.62, 3.25, 0.28],
    scale: [1.05, 0.88, 1.0],
    castShadow: false,
    tint: 'broadleafLight',
  },
  {
    radius: 1.0,
    offset: [-0.55, 3.4, -0.38],
    scale: [1.0, 0.85, 1.08],
    castShadow: false,
    tint: 'broadleaf',
  },
  {
    radius: 0.92,
    offset: [0.12, 4.35, 0.08],
    scale: [1.08, 0.9, 1.02],
    castShadow: false,
    tint: 'broadleafLight',
  },
];

/** Аппроксимация кроны лиственного для коллайдера */
export const BROADLEAF_CROWN_RADIUS = 1.65;
export const BROADLEAF_CROWN_LOCAL_Y = 3.55;

/** Сегменты конуса / сферы кроны */
export const CROWN_RADIAL_SEGMENTS = 8;
export const CROWN_HEIGHT_SEGMENTS = 6;

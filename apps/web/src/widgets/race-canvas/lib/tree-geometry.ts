/** Shared tree dimensions: visuals and colliders import from here. Units are local, before per-tree scale. */

/** Trunk bottom radius (at ground, wider) */
export const TRUNK_RADIUS_BOTTOM = 0.3;
/** Trunk top radius / trunk collider radius */
export const TRUNK_RADIUS = 0.14;
/** Trunk height */
export const TRUNK_HEIGHT = 2.85;
/** Trunk center along Y */
export const TRUNK_LOCAL_Y = TRUNK_HEIGHT / 2;
/** Trunk cylinder segments */
export const TRUNK_SEGMENTS = 8;

/** Trunk scale multipliers by kind (one cylinder geometry) */
export const TRUNK_KIND_SCALE = {
  pine: { xz: 0.92, y: 1.12 },
  broadleaf: { xz: 1.12, y: 0.88 },
} as const;

/** One pine crown tier */
export type TPineTier = {
  /** Cone base radius */
  radius: number;
  /** Cone height */
  height: number;
  /** Cone center along Y */
  localY: number;
  /** Whether to cast shadow (only the largest one) */
  castShadow: boolean;
  /** Tint key in the palette */
  tint: 'pineDark' | 'pine' | 'pineLight';
};

/** Three pine tiers: wide bottom → narrow top */
export const PINE_TIERS: readonly TPineTier[] = [
  { radius: 1.55, height: 2.05, localY: 3.15, castShadow: true, tint: 'pineDark' },
  { radius: 1.12, height: 1.85, localY: 4.45, castShadow: false, tint: 'pine' },
  { radius: 0.68, height: 1.55, localY: 5.65, castShadow: false, tint: 'pineLight' },
];

/** Pine crown approximation for the collider */
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

/** Broadleaf crown share */
export type TBroadleafLobe = {
  /** Sphere radius before non-uniform scale */
  radius: number;
  /** Center relative to the tree base */
  offset: readonly [number, number, number];
  /** Non-uniform scale → ellipsoid */
  scale: readonly [number, number, number];
  /** Whether to cast shadow */
  castShadow: boolean;
  /** Tint key */
  tint: 'broadleaf' | 'broadleafLight';
};

/** 4 overlapping lobes of an irregular crown */
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

/** Broadleaf crown approximation for the collider */
export const BROADLEAF_CROWN_RADIUS = 1.65;
export const BROADLEAF_CROWN_LOCAL_Y = 3.55;

/** Crown cone / sphere segments */
export const CROWN_RADIAL_SEGMENTS = 8;
export const CROWN_HEIGHT_SEGMENTS = 6;

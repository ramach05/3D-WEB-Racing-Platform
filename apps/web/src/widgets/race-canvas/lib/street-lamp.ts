/** Street lamp geometry — visuals and colliders derived from the same numbers */

/** Top of asphalt (same as gantry) */
export const STREET_LAMP_ROAD_TOP_Y = 0.1;

/** Pole height up to the bracket */
export const STREET_LAMP_POLE_HEIGHT = 6.5;
/** Pole radius */
export const STREET_LAMP_POLE_RADIUS = 0.09;
/** Pole cylinder segments */
export const STREET_LAMP_POLE_SEGMENTS = 8;

/** Horizontal bracket reach toward the road */
export const STREET_LAMP_ARM_REACH = 1.85;
/** Bracket tube radius */
export const STREET_LAMP_ARM_RADIUS = 0.055;
/** Bracket elbow height above the pole top */
export const STREET_LAMP_ARM_RISE = 0.35;
/** Overlap of bracket segments at the joints (hides visual gaps between cylinders when rotated). */
export const STREET_LAMP_ARM_JOINT_OVERLAP = STREET_LAMP_ARM_RADIUS * 2.2;

/** Y of the pole top (above asphalt) */
export const STREET_LAMP_POLE_TOP_Y = STREET_LAMP_ROAD_TOP_Y + STREET_LAMP_POLE_HEIGHT;

/** Cobra-arm joints in local XY (pole at X=0). 0 — pole top, 1 — elbow, 2 — luminaire. */
export const STREET_LAMP_ARM_JOINTS = [
  { x: 0, y: STREET_LAMP_POLE_TOP_Y },
  { x: STREET_LAMP_ARM_REACH * 0.4, y: STREET_LAMP_POLE_TOP_Y + STREET_LAMP_ARM_RISE },
  {
    x: STREET_LAMP_ARM_REACH,
    y: STREET_LAMP_POLE_TOP_Y + STREET_LAMP_ARM_RISE * 0.2,
  },
] as const;

/** Luminaire housing [width, height, depth] */
export const STREET_LAMP_HOUSING = {
  width: 0.55,
  height: 0.14,
  depth: 0.32,
} as const;

/** Lens under the housing */
export const STREET_LAMP_LENS = {
  width: 0.42,
  height: 0.04,
  depth: 0.24,
} as const;

/** Y of the luminaire center (above asphalt) — at the bracket end */
export const STREET_LAMP_LUMINAIRE_Y = STREET_LAMP_ARM_JOINTS[2].y;

/** Local X of the luminaire (toward the road) */
export const STREET_LAMP_LUMINAIRE_LOCAL_X = STREET_LAMP_ARM_JOINTS[2].x;

/** Aim the SpotLight at the asphalt (local X from the luminaire further toward the lane). Real cobra-heads pour the main pool onto the roadway, not under the pole. */
export const STREET_LAMP_SPOT_AIM_LOCAL_X = STREET_LAMP_LUMINAIRE_LOCAL_X + 3.4;

/** SpotLight: bright LED cone onto the road. Intensity comparable to car headlights; active only on the nearest K poles. */
export const STREET_LAMP_SPOT = {
  intensity: 110,
  distance: 30,
  /** ~42° — wide road Type-III pool */
  angle: 0.72,
  penumbra: 0.88,
  decay: 2,
} as const;

/** Night City budget: Spot only on the K nearest lamps (farther ones — emissive lens). Shadow map — on the single nearest one among the active. */
export const STREET_LAMP_ACTIVE_SPOTS = {
  /** How many SpotLights to mount at once */
  count: 4,
  /** Keep the previous Spot until it is farther than the K-th + hysteresis (m) */
  switchHysteresis: 8,
} as const;

/** Shadow map only on the single nearest Spot (Night City budget ≤3 passes). */
export const STREET_LAMP_SPOT_SHADOW = {
  mapSize: 256,
  bias: -0.0001,
  normalBias: 0.02,
  near: 0.5,
  /** Switch the caster only if the new one is closer than the current one by this many meters */
  switchHysteresis: 8,
} as const;

/** Lens emissive for Bloom */
export const STREET_LAMP_LENS_EMISSIVE_INTENSITY = 2.4;

/** Half-extents of the cuboid pole collider */
export const STREET_LAMP_COLLIDER = {
  halfWidth: STREET_LAMP_POLE_RADIUS * 1.15,
  halfHeight: STREET_LAMP_POLE_HEIGHT / 2,
  halfDepth: STREET_LAMP_POLE_RADIUS * 1.15,
} as const;

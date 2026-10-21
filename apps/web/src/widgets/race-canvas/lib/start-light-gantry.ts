import type { TCountdownStep, TRaceStatus } from '@/features/race-session';

export const START_LAMP_COUNT = 5;

/** F1-gantry geometry — visuals and colliders derived from the same numbers */
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

/** Geometry of one F1 lamp bay (hood, recess, bezel, lens disc). Panel colliders stay unchanged — visual only. */
export const START_LAMP_BAY = {
  /** Radius of the glowing lens disc */
  lensRadius: 0.2,
  /** Outer radius of the metal ring */
  bezelOuterRadius: 0.255,
  /** Ring depth along Z */
  bezelDepth: 0.055,
  /** Depth of the dark recess in the housing */
  recessDepth: 0.07,
  /** Recess radius (slightly larger than bezel) */
  recessRadius: 0.27,
  /** Spacing between lamp centers along X */
  spacing: 0.62,
  /** Face plane outset from the panel front face */
  faceOutset: 0.02,
  hood: {
    width: 0.52,
    height: 0.06,
    depth: 0.22,
    /** Hood center offset upward from the lens center */
    offsetY: 0.28,
    /** Hood outset forward from the lens plane */
    offsetZ: 0.08,
  },
  /** Emissive of an unlit lens (barely visible LED grid) */
  idleEmissiveIntensity: 0.08,
  /** Emissive of a lit lens — bright in daylight without Bloom */
  litEmissiveIntensity: 6.5,
} as const;

/**
 * Stadium floodlights on the gantry posts (Night City).
 * Mounted on the inner face of the post: plate → bracket → housing.
 * 2 pcs (left/right); aim — at the finish line; Spot from the lens.
 * Important: Group.lookAt points +Z at the target (not −Z like Camera).
 */
export const GANTRY_FLOOD = {
  /** Mount node drop from the beam center (below the beam bottom) */
  mountDropY: 0.22,
  /** Plate offset along |Z| from the post axis (slightly toward spawn) */
  mountZOffset: 0.03,
  /** Plate on the inner face of the post (toward the panel) */
  mountPlate: {
    width: 0.08,
    height: 0.1,
    depth: 0.025,
  },
  /** Short bracket toward the panel */
  arm: {
    radius: 0.012,
    length: 0.12,
  },
  /** Yoke at the bracket end */
  yoke: {
    width: 0.07,
    height: 0.032,
    depth: 0.028,
  },
  /** Compact flood housing */
  housing: {
    width: 0.11,
    height: 0.065,
    depth: 0.13,
  },
  /** Hood above the lens */
  hood: {
    width: 0.12,
    height: 0.014,
    depth: 0.07,
    offsetY: 0.032,
    offsetZ: 0.02,
  },
  /** Lens / Spot on the front face (+Z after Group.lookAt). Disc, not sphere — glow only from the track side. */
  lens: {
    localY: -0.005,
    localZ: 0.068,
    radius: 0.026,
  },
  /** Aim |Z| at the finish line (checker ≈ 0) */
  aimZ: 0.08,
  /** Aim |X| — middle of its own half of the panel */
  aimXFraction: 0.22,
  /** Lens emissive for Bloom */
  lensEmissiveIntensity: 1.6,
} as const;

/** SpotLight: pool of light on the finish line */
export const GANTRY_FLOOD_SPOT = {
  intensity: 85,
  distance: 18,
  /** ~35° — compact pool on the checker */
  angle: 0.62,
  penumbra: 0.75,
  decay: 2,
} as const;

/**
 * Spill at the posts was removed — it lit the post instead of the track.
 * @deprecated
 */
export const GANTRY_FLOOD_POINT = {
  intensity: 0,
  distance: 12,
  decay: 2,
} as const;

/** 2 floods: left/right post */
export const GANTRY_FLOOD_PLACEMENTS = [
  { sideX: -1, sideZ: 1 },
  { sideX: 1, sideZ: 1 },
] as const;

/** How many edge lamps are lit at each countdown step (3→2→1); 0 = all go dark (GO) */
const LIT_BY_COUNTDOWN_STEP: Record<TCountdownStep, number> = {
  3: 2,
  2: 4,
  1: 5,
  0: 0,
};

/** Full finish-lamp blink cycle (s): 0.5 on + 0.5 off */
export const FINISH_LAMP_BLINK_PERIOD_S = 1;

/** Number of lit edge lamps by HUD status (symmetric from the edges toward the center). */
export const litCountForHud = (
  status: TRaceStatus,
  countdownStep: TCountdownStep | null,
): number => {
  if (status === 'countdown' && countdownStep !== null) {
    return LIT_BY_COUNTDOWN_STEP[countdownStep];
  }
  return 0;
};

/** Lamp index (0..n-1) is lit if it is among the litCount edge lamps. */
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

/** Square-wave blink of the finish lamps (~1 Hz, 50% duty). No sin — like real relays/traffic lights. */
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

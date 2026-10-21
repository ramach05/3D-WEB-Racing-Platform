import type { TLoopPoint } from '@/entities/track';
import { VEHICLE_LATERAL_GRIP } from '@/features/race-session';
import { KERB_WIDTH } from '@/widgets/race-canvas/lib/kerb-ribbon-geometry';
import { distanceToCenterlineSq } from '@/widgets/race-canvas/lib/terrain-height';

/** Lateral grip on full offroad */
export const OFFROAD_LATERAL_GRIP = 4.5;

/** Share of longitudinal speed gain from throttle on offroad */
export const OFFROAD_THROTTLE_FACTOR = 0.72;

/** Lateral grip on the kerb (slightly weaker than asphalt) */
export const KERB_LATERAL_GRIP = 8.5;

/** Below this |speed| (m/s) dirt-smoke / kerb rumble are inactive */
export const SURFACE_FX_SPEED_MIN = 6;

/** At this |speed| (m/s) off-road SFX / smoke ≈ peak */
export const SURFACE_FX_SPEED_FULL = 22;

export type TTrackSurfaceKind = 'asphalt' | 'kerb' | 'offroad';

export type TWheelSurfaceFractions = {
  /** Share of wheels on clean asphalt 0…1 */
  asphalt: number;
  /** Share of wheels on the kerb 0…1 */
  kerb: number;
  /** Share of wheels beyond the road edge 0…1 */
  offroad: number;
};

/** Classifies the surface by lateral distance to the centerline */
export const sampleTrackSurfaceKind = (
  x: number,
  z: number,
  centerline: TLoopPoint[],
  roadWidth: number,
  roadWidths?: readonly number[],
): TTrackSurfaceKind => {
  const dist = Math.sqrt(distanceToCenterlineSq(x, z, centerline));
  let half: number;
  if (roadWidths && roadWidths.length > 0) {
    let best = Infinity;
    let bestIdx = 0;
    const n = centerline.length;
    for (let i = 0; i < n; i += 1) {
      const a = centerline[i];
      const b = centerline[(i + 1) % n];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const lenSq = dx * dx + dz * dz;
      const t =
        lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lenSq));
      const px = a.x + dx * t;
      const pz = a.z + dz * t;
      const dSq = (x - px) ** 2 + (z - pz) ** 2;
      if (dSq < best) {
        best = dSq;
        bestIdx = i;
      }
    }
    const frac = bestIdx / n;
    let prev: { idx: number; w: number } | null = null;
    let next: { idx: number; w: number } | null = null;
    const rwN = roadWidths.length;
    for (let j = 0; j < rwN; j += 1) {
      const jFrac = j / rwN;
      if (jFrac <= frac) prev = { idx: j, w: roadWidths[j]! };
      else {
        next = { idx: j, w: roadWidths[j]! };
        break;
      }
    }
    if (prev && next) {
      const range = next.idx - prev.idx;
      const t2 = range > 0 ? (bestIdx - prev.idx) / range : 0;
      half = (prev.w + (next.w - prev.w) * t2) / 2;
    } else {
      half = prev ? prev.w / 2 : roadWidth / 2;
    }
  } else {
    half = roadWidth / 2;
  }
  if (dist > half) {
    return 'offroad';
  }
  if (dist > half - KERB_WIDTH) {
    return 'kerb';
  }
  return 'asphalt';
};

/** Computes asphalt / kerb / offroad shares over the set of wheels */
export const aggregateWheelSurfaces = (kinds: TTrackSurfaceKind[]): TWheelSurfaceFractions => {
  const total = kinds.length;
  if (total === 0) {
    return { asphalt: 0, kerb: 0, offroad: 0 };
  }
  let asphalt = 0;
  let kerb = 0;
  let offroad = 0;
  for (const kind of kinds) {
    if (kind === 'asphalt') {
      asphalt += 1;
    } else if (kind === 'kerb') {
      kerb += 1;
    } else {
      offroad += 1;
    }
  }
  return {
    asphalt: asphalt / total,
    kerb: kerb / total,
    offroad: offroad / total,
  };
};

/** Micro-variation of asphalt grip 0.92…1.05 by world XZ. Deterministic value-noise without allocations. */
export const sampleAsphaltMicroGrip = (x: number, z: number): number => {
  const nx = Math.floor(x * 0.35);
  const nz = Math.floor(z * 0.35);
  let n = (nx * 374761393 + nz * 668265263 + 0x51ace) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  const u = ((n ^ (n >>> 16)) >>> 0) / 0xffffffff;
  return 0.92 + u * 0.13;
};

/**
 * Effective surfaceGrip: oil > offroad > kerb > asphalt(+micro).
 * Lower value = more slippery (cap for dampLateralVelocity).
 * Oil is an overlay with absolute priority over the lateral surface.
 */
export const combineSurfaceGrip = (
  oilGrip: number | undefined,
  offroadFrac: number,
  kerbFrac: number,
  asphaltMicro: number,
): number => {
  if (oilGrip !== undefined) {
    return oilGrip;
  }

  const micro = Math.max(0.85, Math.min(1.1, asphaltMicro));
  let grip = VEHICLE_LATERAL_GRIP * micro;

  const kerb = Math.max(0, Math.min(1, kerbFrac));
  if (kerb > 0) {
    grip = grip * (1 - kerb) + KERB_LATERAL_GRIP * kerb;
  }

  const off = Math.max(0, Math.min(1, offroadFrac));
  if (off > 0) {
    grip = grip * (1 - off) + OFFROAD_LATERAL_GRIP * off;
  }

  return grip;
};

/** Softens longitudinal speed gain on offroad (wheel share 0…1). */
export const applyOffroadThrottleFactor = (
  forwardSpeed: number,
  targetForward: number,
  throttle: number,
  offroadFrac: number,
): number => {
  const frac = Math.max(0, Math.min(1, offroadFrac));
  if (frac <= 0 || throttle <= 0) {
    return targetForward;
  }
  const delta = targetForward - forwardSpeed;
  if (delta <= 0) {
    return targetForward;
  }
  const factor = 1 - (1 - OFFROAD_THROTTLE_FACTOR) * frac;
  return forwardSpeed + delta * factor;
};

/** Offroad effects strength 0…1 from wheel share and speed */
export const computeOffroadFxStrength = (offroadFrac: number, forwardSpeed: number): number => {
  const frac = Math.max(0, Math.min(1, offroadFrac));
  if (frac <= 0) {
    return 0;
  }
  const speed = Math.abs(forwardSpeed);
  if (speed < SURFACE_FX_SPEED_MIN) {
    return 0;
  }
  const speedFactor = Math.min(
    1,
    (speed - SURFACE_FX_SPEED_MIN) / (SURFACE_FX_SPEED_FULL - SURFACE_FX_SPEED_MIN),
  );
  return frac * speedFactor;
};

/** Kerb rumble strength 0…1 */
export const computeKerbRumble = (kerbFrac: number, forwardSpeed: number): number => {
  const frac = Math.max(0, Math.min(1, kerbFrac));
  if (frac <= 0) {
    return 0;
  }
  const speed = Math.abs(forwardSpeed);
  if (speed < SURFACE_FX_SPEED_MIN) {
    return 0;
  }
  const speedFactor = Math.min(
    1,
    (speed - SURFACE_FX_SPEED_MIN) / (SURFACE_FX_SPEED_FULL - SURFACE_FX_SPEED_MIN),
  );
  return Math.min(1, frac * (0.35 + 0.65 * speedFactor));
};

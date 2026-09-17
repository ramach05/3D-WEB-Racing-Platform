import type { TLoopPoint } from '@/entities/track';
import { VEHICLE_LATERAL_GRIP } from '@/features/race-session/vehicle-physics';
import { KERB_WIDTH } from '@/widgets/race-canvas/lib/kerb-ribbon-geometry';
import { distanceToCenterlineSq } from '@/widgets/race-canvas/lib/terrain-height';

/** Боковой grip на полном оффроуде */
export const OFFROAD_LATERAL_GRIP = 4.5;

/** Доля прироста продольной скорости от газа на оффроуде */
export const OFFROAD_THROTTLE_FACTOR = 0.72;

/** Боковой grip на поребрике (чуть слабее асфальта) */
export const KERB_LATERAL_GRIP = 8.5;

/** Ниже этой |скорости| (м/с) dirt-smoke / kerb rumble не активны */
export const SURFACE_FX_SPEED_MIN = 6;

/** При этой |скорости| (м/с) off-road SFX / smoke ≈ пик */
export const SURFACE_FX_SPEED_FULL = 22;

export type TTrackSurfaceKind = 'asphalt' | 'kerb' | 'offroad';

export type TWheelSurfaceFractions = {
  /** Доля колёс на чистом асфальте 0…1 */
  asphalt: number;
  /** Доля колёс на поребрике 0…1 */
  kerb: number;
  /** Доля колёс за краем дороги 0…1 */
  offroad: number;
};

/** Классифицирует покрытие по латеральному расстоянию до centerline */
export const sampleTrackSurfaceKind = (
  x: number,
  z: number,
  centerline: TLoopPoint[],
  roadWidth: number,
): TTrackSurfaceKind => {
  const half = roadWidth / 2;
  const dist = Math.sqrt(distanceToCenterlineSq(x, z, centerline));
  if (dist > half) {
    return 'offroad';
  }
  if (dist > half - KERB_WIDTH) {
    return 'kerb';
  }
  return 'asphalt';
};

/** Считает доли asphalt / kerb / offroad по набору колёс */
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

/**
 * Микро-вариация grip асфальта 0.92…1.05 по мировым XZ.
 * Детерминированный value-noise без аллокаций.
 */
export const sampleAsphaltMicroGrip = (x: number, z: number): number => {
  const nx = Math.floor(x * 0.35);
  const nz = Math.floor(z * 0.35);
  let n = (nx * 374761393 + nz * 668265263 + 0x51ace) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  const u = ((n ^ (n >>> 16)) >>> 0) / 0xffffffff;
  return 0.92 + u * 0.13;
};

/**
 * Эффективный surfaceGrip: oil > offroad > kerb > asphalt(+micro).
 * Меньше значение = скользче (cap для dampLateralVelocity).
 * Oil — оверлей с абсолютным приоритетом над латеральным покрытием.
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

/**
 * Смягчает прирост продольной скорости на оффроуде (доля колёс 0…1).
 */
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

/** Сила оффроуд-эффектов 0…1 от доли колёс и скорости */
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

/** Сила rumble поребрика 0…1 */
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

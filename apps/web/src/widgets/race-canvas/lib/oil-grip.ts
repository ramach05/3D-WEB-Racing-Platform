import { VEHICLE_LATERAL_GRIP } from '@/features/race-session';

/** Lateral grip on fully oil (all 4 wheels) — looser than the handbrake */
export const OIL_LATERAL_GRIP = 2.2;

/** Share of longitudinal speed gain from throttle on oil */
export const OIL_THROTTLE_FACTOR = 0.9;

/** Decay time of the residual after leaving the slick (s) */
export const OIL_RESIDUAL_SEC = 0.8;

/** Yaw added (rad/s) at full steer on oil at ~top speed. Noticeable twitch, no instant spin. */
export const OIL_STEER_YAW_KICK = 0.55;

/** Yaw added from existing lateral slide (at |lateral|=8) */
export const OIL_LATERAL_YAW_KICK = 0.28;

/** Below this |speed| (m/s) oil skid marks are not drawn */
export const OIL_SKID_SPEED_MIN = 8;

/** At this |speed| (m/s) oil-skid intensity ≈ peak */
export const OIL_SKID_SPEED_FULL = 24;

/** Peak oil skid-mark intensity (weaker than braking) */
export const OIL_SKID_INTENSITY_PEAK = 0.55;

/** Oil tire coverage strength 0…1 (share of wheels on oil / residual) */
let oilStrength = 0;

/** Update oil strength. `contactFraction` — share of wheels on the slick (0…1); 0 = driven off, residual fades. */
export const tickOilGrip = (contactFraction: number, dt: number): number => {
  const clamped = Math.max(0, Math.min(1, contactFraction));
  if (clamped > 0) {
    oilStrength = clamped;
  } else if (oilStrength > 0) {
    oilStrength = Math.max(0, oilStrength - dt / OIL_RESIDUAL_SEC);
  }
  return oilStrength;
};

/** Resets the oil residual (race restart) */
export const resetOilGrip = () => {
  oilStrength = 0;
};

/**
 * Effective surfaceGrip for dampLateralVelocity, or undefined when there is no oil.
 * At strength=1 → OIL_LATERAL_GRIP; while fading it returns to asphalt quadratically.
 */
export const resolveOilSurfaceGrip = (strength: number): number | undefined => {
  if (strength <= 0) {
    return undefined;
  }
  const t = (1 - strength) * (1 - strength);
  return OIL_LATERAL_GRIP + (VEHICLE_LATERAL_GRIP - OIL_LATERAL_GRIP) * t;
};

/** Softens the longitudinal speed gain from throttle on oil (forward inertia is preserved). */
export const applyOilThrottleFactor = (
  forwardSpeed: number,
  targetForward: number,
  throttle: number,
  strength: number,
): number => {
  if (strength <= 0 || throttle <= 0) {
    return targetForward;
  }
  const delta = targetForward - forwardSpeed;
  if (delta <= 0) {
    return targetForward;
  }
  const factor = 1 - (1 - OIL_THROTTLE_FACTOR) * strength;
  return forwardSpeed + delta * factor;
};

/** Extra yaw on oil: from steering and from existing lateral slide. */
export const computeOilYawKick = (
  strength: number,
  steer: number,
  forwardSpeed: number,
  lateral: number,
): number => {
  if (strength <= 0) {
    return 0;
  }
  const speedNorm = Math.min(1, Math.abs(forwardSpeed) / 30);
  const steerKick = steer * speedNorm * OIL_STEER_YAW_KICK;
  const lateralNorm = Math.min(1, Math.abs(lateral) / 8);
  const lateralKick = Math.sign(lateral || steer) * lateralNorm * OIL_LATERAL_YAW_KICK;
  return strength * (steerKick + lateralKick);
};

/** Oil skid-mark intensity 0…1 at the given speed and strength */
export const computeOilSkidIntensity = (strength: number, forwardSpeed: number): number => {
  if (strength <= 0) {
    return 0;
  }
  const speed = Math.abs(forwardSpeed);
  if (speed < OIL_SKID_SPEED_MIN) {
    return 0;
  }
  const speedFactor = Math.min(
    1,
    (speed - OIL_SKID_SPEED_MIN) / (OIL_SKID_SPEED_FULL - OIL_SKID_SPEED_MIN),
  );
  return Math.min(1, strength * OIL_SKID_INTENSITY_PEAK * (0.55 + 0.45 * speedFactor));
};

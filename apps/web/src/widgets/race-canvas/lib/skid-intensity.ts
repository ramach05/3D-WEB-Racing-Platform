/** Below this forward speed (m/s) there are no braking skid marks */
export const SKID_SPEED_MIN = 12;

/** At this speed (m/s) the brake-intensity base ≈ 1 before accounting for lateral */
export const SKID_SPEED_FULL = 28;

/** Up to this speed (m/s) launch-wheelspin at full throttle is maximal. Beyond it the mark fades — tires "grab". */
export const LAUNCH_SPEED_PEAK = 2.5;

/** Above this speed (m/s) there are no acceleration marks anymore (~50 km/h) */
export const LAUNCH_SPEED_END = 14;

/** Below this speed there are almost no handbrake marks (unless there is strong lateral) */
export const HANDBRAKE_SKID_SPEED_MIN = 7;

/** At this speed the handbrake-intensity base ≈ 1 before accounting for lateral */
export const HANDBRAKE_SKID_SPEED_FULL = 24;

/** |lateral| (m/s) at which the lateral bonus is maximal */
export const SKID_LATERAL_FULL = 8;

/** Share of the lateral-slide bonus in intensity (braking / launch) */
export const SKID_LATERAL_WEIGHT = 0.25;

/** Strong contribution of lateral break-away to handbrake drift marks */
export const HANDBRAKE_SKID_LATERAL_WEIGHT = 0.55;

/** Intensity multiplier for handbrake + throttle (locked rear + drive) */
export const HANDBRAKE_THROTTLE_SKID_BOOST = 1.15;

/** Intensity threshold for tire smoke */
export const SKID_SMOKE_THRESHOLD = 0.55;

export type TSkidWheels = 'all' | 'rear';

export type TSkidIntensityInput = {
  /** Brake 0|1 */
  brake: number;
  /** Throttle 0|1 */
  throttle: number;
  /** Handbrake 0|1 */
  handbrake: number;
  /** Forward speed along the nose (m/s) */
  forwardSpeed: number;
  /** Lateral speed (m/s) */
  lateral: number;
  /** Whether wheels touch the ground */
  grounded: boolean;
};

export type TSkidIntensityResult = {
  /** 0…1 — mark strength */
  intensity: number;
  /** A short puff of smoke is needed */
  smoking: boolean;
  /** Which wheels leave a mark: lockup under braking — all 4; wheelspin / drift — rear axle (RWD). */
  wheels: TSkidWheels;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** Linear remap of value from [a,b] into [0,1] with clamp */
const remap01 = (value: number, a: number, b: number): number => {
  if (b <= a) {
    return value >= b ? 1 : 0;
  }
  return clamp01((value - a) / (b - a));
};

/** Blends the longitudinal factor with lateral break-away */
const blendWithLateral = (driveFactor: number, lateral: number, lateralWeight: number): number => {
  const lateralFactor = remap01(Math.abs(lateral), 0, SKID_LATERAL_FULL);
  return driveFactor * (1 - lateralWeight) + lateralFactor * lateralWeight;
};

/**
 * Skid-mark heuristic for arcade physics:
 * - hard braking at speed → lockup, all wheels;
 * - handbrake / drift → rear axle break-away;
 * - hard launch from standstill / low speed → rear axle wheelspin.
 */
export const computeSkidIntensity = (input: TSkidIntensityInput): TSkidIntensityResult => {
  if (!input.grounded) {
    return { intensity: 0, smoking: false, wheels: 'all' };
  }

  const speed = Math.abs(input.forwardSpeed);
  const lateral = input.lateral;

  // Braking takes priority: with brake+throttle it is more likely an emergency stop, not a burnout pad.
  if (input.brake > 0) {
    if (speed < SKID_SPEED_MIN) {
      return { intensity: 0, smoking: false, wheels: 'all' };
    }
    const speedFactor = remap01(speed, SKID_SPEED_MIN, SKID_SPEED_FULL);
    const intensity = clamp01(
      input.brake * blendWithLateral(speedFactor, lateral, SKID_LATERAL_WEIGHT),
    );
    return {
      intensity,
      smoking: intensity > SKID_SMOKE_THRESHOLD,
      wheels: 'all',
    };
  }

  if (input.handbrake > 0) {
    const speedFactor = remap01(speed, HANDBRAKE_SKID_SPEED_MIN, HANDBRAKE_SKID_SPEED_FULL);
    let intensity = blendWithLateral(speedFactor, lateral, HANDBRAKE_SKID_LATERAL_WEIGHT);
    if (input.throttle > 0) {
      intensity *= HANDBRAKE_THROTTLE_SKID_BOOST;
    }
    intensity = clamp01(intensity);
    if (intensity <= 0) {
      return { intensity: 0, smoking: false, wheels: 'rear' };
    }
    return {
      intensity,
      smoking: intensity > SKID_SMOKE_THRESHOLD,
      wheels: 'rear',
    };
  }

  if (input.throttle > 0 && speed < LAUNCH_SPEED_END) {
    // Full break-away at the start, then fading as speed builds (like in real life).
    const launchEnvelope =
      speed <= LAUNCH_SPEED_PEAK ? 1 : 1 - remap01(speed, LAUNCH_SPEED_PEAK, LAUNCH_SPEED_END);
    const intensity = clamp01(
      input.throttle * blendWithLateral(launchEnvelope, lateral, SKID_LATERAL_WEIGHT),
    );
    return {
      intensity,
      smoking: intensity > SKID_SMOKE_THRESHOLD,
      wheels: 'rear',
    };
  }

  return { intensity: 0, smoking: false, wheels: 'all' };
};

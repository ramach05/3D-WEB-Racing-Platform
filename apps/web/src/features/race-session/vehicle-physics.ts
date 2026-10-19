export const VEHICLE_MAX_SPEED = 30;
export const VEHICLE_REVERSE_MAX = 10;
export const VEHICLE_ACCEL = 48;
export const VEHICLE_BRAKE = 72;
export const VEHICLE_LATERAL_GRIP = 11;
/** Peak steering force after acceleration; weaker below it to avoid spinning in place */
export const VEHICLE_LOW_SPEED_STEER = 0.58;
export const VEHICLE_HIGH_SPEED_STEER = 0.42;
/** Steering force ramps up from zero up to this speed (m/s). Above the former 1.4 — at crawl speed yaw does not spin the car in place. */
export const VEHICLE_STEER_ENGAGE_SPEED = 5;

/** Target yaw rate (rad/s) at full steering strength (strength=1). Close to arcade base (~4.32), still a bit calmer. */
export const VEHICLE_STEER_YAW_RATE = 3.6;

/** Yaw convergence rate toward the target (1/s). Closer to the arcade (0.75) response at a 1/60 frame. */
export const VEHICLE_YAW_FOLLOW = -Math.log(0.78) * 60;

/** Yaw decay at standstill (1/s). Matches the former `angvel * 0.12` at a 1/60 frame: -ln(0.12)*60. */
export const VEHICLE_YAW_STOP = -Math.log(0.12) * 60;

/** Handbrake deceleration (m/s²) — weaker than the foot brake, but without a long coast */
export const HANDBRAKE_DECEL = 40;

/** Throttle factor while the handbrake is held: 0.35 * ACCEL − HANDBRAKE_DECEL ≈ −23 m/s² — drift that scrubs speed */
export const HANDBRAKE_THROTTLE_FACTOR = 0.35;

/** Lateral grip with handbrake and no throttle */
export const HANDBRAKE_LATERAL_GRIP = 2;

/** Lateral grip with handbrake + throttle (stronger rear axle breakaway) */
export const HANDBRAKE_THROTTLE_LATERAL_GRIP = 1.2;

/** Steering strength multiplier with the handbrake (initiation handbrake turn) */
export const HANDBRAKE_STEER_BOOST = 1.45;

export type TDriveLongitudinalInput = {
  throttle: number;
  brake: number;
  handbrake: number;
  dt: number;
};

/** Integrates longitudinal speed: handbrake takes priority over the foot brake and bleeds speed to zero from both signs; without handbrake — brake/reverse as before. */
export const integrateDriveForward = (
  forwardSpeed: number,
  input: TDriveLongitudinalInput,
): number => {
  let target = forwardSpeed;
  const { throttle, brake, handbrake, dt } = input;

  if (handbrake > 0) {
    if (throttle > 0) {
      target += throttle * VEHICLE_ACCEL * HANDBRAKE_THROTTLE_FACTOR * dt;
    }
    if (target > 0) {
      target = Math.max(0, target - handbrake * HANDBRAKE_DECEL * dt);
    } else if (target < 0) {
      target = Math.min(0, target + handbrake * HANDBRAKE_DECEL * dt);
    }
    return target;
  }

  if (brake > 0) {
    if (throttle > 0) {
      target += throttle * VEHICLE_ACCEL * dt;
    }
    target -= brake * VEHICLE_BRAKE * dt;
    return target;
  }

  if (throttle > 0) {
    target += throttle * VEHICLE_ACCEL * dt;
  }
  return target;
};

/** Exponential damping of lateral speed; handbrake heavily reduces grip */
export const dampLateralVelocity = (
  lateral: number,
  handbrake: number,
  throttle: number,
  dt: number,
  surfaceGrip?: number,
): number => {
  let grip = VEHICLE_LATERAL_GRIP;
  if (handbrake > 0) {
    grip = throttle > 0 ? HANDBRAKE_THROTTLE_LATERAL_GRIP : HANDBRAKE_LATERAL_GRIP;
  }
  if (surfaceGrip !== undefined) {
    grip = Math.min(grip, surfaceGrip);
  }
  return lateral * Math.exp(-grip * dt);
};

/** Steering strength: 0 at standstill, ramps up smoothly to engage, weaker near top speed; handbrake boosts it */
export const computeSteerStrength = (forwardSpeed: number, handbrake = 0): number => {
  const absSpeed = Math.abs(forwardSpeed);
  if (absSpeed < 0.12) {
    return 0;
  }
  const engage = Math.min(1, absSpeed / VEHICLE_STEER_ENGAGE_SPEED);
  const speedRatio = Math.min(1, absSpeed / VEHICLE_MAX_SPEED);
  const curve =
    VEHICLE_LOW_SPEED_STEER + (VEHICLE_HIGH_SPEED_STEER - VEHICLE_LOW_SPEED_STEER) * speedRatio;
  const base = curve * engage;
  return handbrake > 0 ? base * HANDBRAKE_STEER_BOOST : base;
};

/** New yaw rate (rad/s), independent of FPS. The old `* 0.75` per frame gave nearly twice the response in heavy scenes (Night City). */
export const integrateSteerYaw = (
  currentYaw: number,
  steerInput: number,
  steerStrength: number,
  steerSign: number,
  dt: number,
): number => {
  if (steerStrength <= 0) {
    return currentYaw * Math.exp(-VEHICLE_YAW_STOP * dt);
  }
  const targetYaw = steerInput * VEHICLE_STEER_YAW_RATE * steerStrength * steerSign;
  const follow = 1 - Math.exp(-VEHICLE_YAW_FOLLOW * dt);
  return currentYaw + (targetYaw - currentYaw) * follow;
};

/** A surface contact counts as "road" only when the normal is nearly vertical (walls — no) */
export const GROUND_NORMAL_MIN_Y = 0.5;

/** Max slope grade (deg) treated as drivable surface: steeper means wall/curb/embankment */
export const SLOPE_MAX_GRADE_DEG = 20;
export const SLOPE_MAX_GRADE = (SLOPE_MAX_GRADE_DEG * Math.PI) / 180;
/** Normal threshold for usable ground, fit for climbing and visual tilt */
export const SLOPE_CONTACT_NORMAL_MIN_Y = Math.cos(SLOPE_MAX_GRADE);

/** Cap on the vertical climb component on a slope (m/s): guards against being launched up on a tilted normal */
export const MAX_CLIMB_VY = 8;

/**
 * Vertical velocity (m/s) needed to slide along a plane with normal
 * (nx, ny, nz) at horizontal velocity (vx, vz). Returns 0 on flat ground; on a climb —
 * exactly what keeps the body from sinking into the road surface. Clamped in magnitude so a
 * steep normal (drop-off/embankment/curb) does not launch the car upward at high speed.
 */
export const computeGroundFollowVy = (
  nx: number,
  ny: number,
  nz: number,
  vx: number,
  vz: number,
): number => {
  if (ny < SLOPE_CONTACT_NORMAL_MIN_Y) {
    return 0;
  }
  const vy = -(nx * vx + nz * vz) / ny;
  const clamped = Math.max(-MAX_CLIMB_VY, Math.min(MAX_CLIMB_VY, vy));
  return clamped === 0 ? 0 : clamped;
};

/**
 * Final vertical velocity on surface contact. On flat ground and climbs it
 * prevents sinking into the road surface and bouncing the body. On a descent (followVy < 0)
 * we aim along the plane with no margin: gravity cannot build the needed drop within one frame,
 * the body lags behind the deck running away below (Y is also pressed down positionally,
 * see computeGroundStickY) — otherwise a gap accumulates and a jarring snap shakes the car.
 */
export const resolveGroundFollowVy = (followVy: number, linvelY: number): number =>
  followVy >= 0 ? Math.max(followVy, Math.min(linvelY, 0)) : Math.min(linvelY, followVy);

/** Margin above the equilibrium rest height on a slope for the positional stick target (m) */
export const GROUND_STICK_MARGIN = 0.02;

/** Cap on the per-frame drop from the positional stick (m): never teleport the body down harder */
export const GROUND_STICK_MAX_DROP = 0.15;

/**
 * Rest height of the horizontal capsule (tilt is forbidden) on a slope: its lower
 * edge, 2·halfLen long, digs into the road surface rising toward the rear — the body sits
 * above the deck under the wheels by halfLen·tanθ. This cannot be ignored: snapping to the
 * "deck under the wheels" buries the capsule's rear in the trimesh, launches it up and
 * friction eats away speed and handling.
 */
export const computeGroundRestY = (
  deckY: number,
  nx: number,
  ny: number,
  nz: number,
  halfLen: number,
): number => deckY + halfLen * (Math.hypot(nx, nz) / Math.max(ny, 0.5));

/**
 * Target Y for the positional stick: equilibrium rest height + margin when the body
 * is above it (otherwise null — never lift). Needed both on a descent (the solver damps
 * the normal vy component, the body lags the deck running away below) and near the crest
 * of a climb (tangential vy overshoots upward on a convex profile): without the
 * correction the gap grows to the threshold and a jarring snap shakes the body.
 * Drop is capped per frame (GROUND_STICK_MAX_DROP).
 */
export const computeGroundStickY = (restY: number, currentY: number): number | null => {
  const target = restY + GROUND_STICK_MARGIN;
  if (target >= currentY) {
    return null;
  }
  return Math.max(target, currentY - GROUND_STICK_MAX_DROP);
};

/** Time constant (s) for smoothing the target vy on climbs/flat ground: smooths the step at the crest */
export const FOLLOW_VY_TAU = 0.05;

/** New vy (m/s) after converging toward the target over dt; exponential, FPS-independent */
export const smoothVyToward = (current: number, target: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-dt / FOLLOW_VY_TAU));

/**
 * Target body pitch (rad, around local X) from the slope normal projected onto
 * the heading direction (fwdX, fwdZ). KEY POINT: depends only on normal geometry,
 * not on speed/heading — so the pitch never "snaps" when entering a corner.
 * Climbing ahead gives a negative angle (nose up). Clamped to the max slope grade.
 */
export const computeSlopePitchFromNormal = (
  nx: number,
  ny: number,
  nz: number,
  fwdX: number,
  fwdZ: number,
): number => {
  if (ny < SLOPE_CONTACT_NORMAL_MIN_Y) {
    return 0;
  }
  const climb = -(nx * fwdX + nz * fwdZ) / ny;
  const pitch = -Math.atan(climb);
  return Math.max(-SLOPE_MAX_GRADE, Math.min(SLOPE_MAX_GRADE, pitch));
};

/** Time constant (s) for visual angle smoothing */
export const ANGLE_SMOOTH_TAU = 0.12;
/** Cap on the visual angle's rate of change (rad/s) */
export const ANGLE_SMOOTH_MAX_RATE = 3;

/** Visual angle (rad) after converging toward target over dt: exponential (FPS-independent) with a step cap — no overshoot on an abrupt target change */
export const smoothAngleToward = (current: number, target: number, dt: number): number => {
  const follow = 1 - Math.exp(-dt / ANGLE_SMOOTH_TAU);
  const step = (target - current) * follow;
  const maxStep = ANGLE_SMOOTH_MAX_RATE * dt;
  return current + Math.max(-maxStep, Math.min(maxStep, step));
};

/**
 * Fuel barrel bounce tuning when hit by the car.
 *
 * The car gets a target speed every frame via setLinvel, so in the solver it acts like a
 * wall with infinite mass. The solver itself can only accelerate the barrel up to the car
 * speed and drag it along: without a directed bounce the barrel "sticks" to the bumper and
 * never flies off. So the impact is computed explicitly: the barrel gets a lateral velocity
 * away from the car axis plus a small longitudinal and vertical component, and the tumble
 * comes from the lever arm of the impulse application point.
 *
 * Deltas are given in m/s, not N·s: mass cancels out, so the values mean "what speed the
 * barrel gains" and do not depend on mass.
 *
 * The settings are tuned so the barrel bounce is comparable to tire scatter and slightly
 * weaker: barrel peak speed ~1.7-1.8 of car speed vs ~1.9-2.0 for the top tier of a tire
 * stack (measured with a headless simulation on the same solver parameters).
 */

/** Mass of an empty steel euro barrel ⌀0.6 × 0.9 m, kg */
export const BARREL_MASS = 25;

/** Longitudinal share of car speed transferred to the barrel (drags it along the heading) */
export const BARREL_FORWARD_SCALE = 0.24;

/** Lateral share of car speed — the main contribution to the bounce */
export const BARREL_SIDE_SCALE = 1.0;

/** Lateral bounce bonus at low speeds, m/s */
export const BARREL_SIDE_BASE_SPEED = 2.6;

/** Vertical share of car speed (pop-up) */
export const BARREL_POP_SCALE = 0.1;

/** Vertical bonus at low speeds, m/s */
export const BARREL_POP_BASE_SPEED = 0.8;

/** Lever arm of the impulse application point from the barrel center, m: above center — tumble */
export const BARREL_HIT_LEVER = 0.1;

/** Equivalent spin lever arm, m: gives the barrel initial rolling along the bounce; friction with the ground and bumper develops the tumble further */
export const BARREL_ROLL_ARM = 0.005;

/** Safety cap: share of car speed */
export const BARREL_SPEED_HEADROOM = 1.75;

/** Safety cap: additive, m/s */
export const BARREL_SPEED_BASE = 2.5;

/** Barrel upward speed cap, m/s; a falling barrel is not limited */
export const BARREL_MAX_UP_SPEED = 6;

/** Barrel angular velocity cap, rad/s */
export const BARREL_MAX_SPIN = 20;

/** Minimum barrel offset from the car axis, m: below it the lateral direction degenerates (dead-center hit into the bumper), side is taken from sideBias */
export const BARREL_SIDE_DEGENERATE_EPS = 0.05;

/** Point or vector in the XZ plane or in space */
export type TBarrelVec3 = { x: number; y: number; z: number };

/** Vector in the road plane */
export type TBarrelVec2 = { x: number; z: number };

/** Parameters of the car hitting a barrel */
export type TBarrelStrike = {
  /** Car center */
  carPosition: TBarrelVec3;
  /** Car velocity in the road plane */
  carVelocity: TBarrelVec2;
  /** Car speed magnitude, m/s (>= HIT_MIN_SPEED) */
  carSpeed: number;
  /** Barrel center */
  barrelPosition: TBarrelVec3;
  /** Bounce side when the offset is degenerate: 1 right of the heading, -1 left */
  sideBias: 1 | -1;
};

/** Impact result: what to apply to the barrel body and with which cap to limit it */
export type TBarrelBounce = {
  /** Impulse, N·s */
  impulse: TBarrelVec3;
  /** Impulse application point in world space */
  point: TBarrelVec3;
  /** Torque impulse for initial rolling, N·m·s */
  torqueImpulse: TBarrelVec3;
  /** Safety cap for horizontal speed after the impact, m/s */
  speedCap: number;
};

/** Bounce direction: perpendicular to the car heading, pointing from its axis toward the barrel. On a dead-center hit the offset degenerates — then the side comes from sideBias. */
export const computeBarrelSideDirection = (
  carVelocity: TBarrelVec2,
  carSpeed: number,
  carPosition: TBarrelVec3,
  barrelPosition: TBarrelVec3,
  sideBias: 1 | -1,
): TBarrelVec2 => {
  if (carSpeed <= 0) {
    return { x: sideBias, z: 0 };
  }
  // perpendicular to the heading in the road plane
  let sideX = carVelocity.z / carSpeed;
  let sideZ = -carVelocity.x / carSpeed;
  const offset =
    (barrelPosition.x - carPosition.x) * sideX + (barrelPosition.z - carPosition.z) * sideZ;
  if (Math.abs(offset) < BARREL_SIDE_DEGENERATE_EPS) {
    return { x: sideX * sideBias, z: sideZ * sideBias };
  }
  if (offset < 0) {
    sideX = -sideX;
    sideZ = -sideZ;
  }
  return { x: sideX, z: sideZ };
};

/** Barrel velocity deltas on impact: longitudinal, lateral and vertical, m/s */
export const computeBarrelDeltaV = (
  carSpeed: number,
): { forward: number; side: number; up: number } => {
  const speed = Math.max(0, carSpeed);
  return {
    forward: BARREL_FORWARD_SCALE * speed,
    side: BARREL_SIDE_SCALE * speed + BARREL_SIDE_BASE_SPEED,
    up: BARREL_POP_SCALE * speed + BARREL_POP_BASE_SPEED,
  };
};

/** Safety cap for the barrel's horizontal speed, m/s. Clearly above car speed: a cap below car speed would "stick" the barrel to the bumper again. */
export const computeBarrelSpeedCap = (carSpeed: number): number =>
  BARREL_SPEED_HEADROOM * Math.max(0, carSpeed) + BARREL_SPEED_BASE;

/**
 * Barrel speed cap after the impact: horizontal — capped with direction preserved,
 * vertical — upward only (a falling barrel obeys gravity), angular velocity — capped
 * with the rotation axis preserved.
 */
export const clampBarrelVelocity = (
  linvel: TBarrelVec3,
  angvel: TBarrelVec3,
  speedCap: number,
): { linvel: TBarrelVec3; angvel: TBarrelVec3 } => {
  const horizontal = Math.hypot(linvel.x, linvel.z);
  const scale = horizontal > speedCap && horizontal > 0 ? speedCap / horizontal : 1;
  const spin = Math.hypot(angvel.x, angvel.y, angvel.z);
  const spinScale = spin > BARREL_MAX_SPIN && spin > 0 ? BARREL_MAX_SPIN / spin : 1;
  return {
    linvel: {
      x: linvel.x * scale,
      y: Math.min(linvel.y, BARREL_MAX_UP_SPEED),
      z: linvel.z * scale,
    },
    angvel: {
      x: angvel.x * spinScale,
      y: angvel.y * spinScale,
      z: angvel.z * spinScale,
    },
  };
};

/** Barrel bounce off the car: impulse applied slightly above center (tumble), lateral component moves the barrel out from under the bumper, spin gives initial rolling. */
export const computeBarrelBounce = ({
  carPosition,
  carVelocity,
  carSpeed,
  barrelPosition,
  sideBias,
}: TBarrelStrike): TBarrelBounce => {
  const side = computeBarrelSideDirection(
    carVelocity,
    carSpeed,
    carPosition,
    barrelPosition,
    sideBias,
  );
  const forwardX = carSpeed > 0 ? carVelocity.x / carSpeed : 0;
  const forwardZ = carSpeed > 0 ? carVelocity.z / carSpeed : 1;
  const { forward, side: sideSpeed, up } = computeBarrelDeltaV(carSpeed);

  // actual launch direction — the barrel starts rolling along it
  const escapeX = forwardX * forward + side.x * sideSpeed;
  const escapeZ = forwardZ * forward + side.z * sideSpeed;
  const escape = Math.hypot(escapeX, escapeZ) || 1;

  const impulseX = BARREL_MASS * escapeX;
  const impulseZ = BARREL_MASS * escapeZ;
  // rolling axis is horizontal and perpendicular to the launch: the sign yields rolling, not a spin
  const rollX = (escapeZ / escape) * BARREL_MASS * BARREL_ROLL_ARM * Math.max(0, carSpeed);
  const rollZ = (-escapeX / escape) * BARREL_MASS * BARREL_ROLL_ARM * Math.max(0, carSpeed);

  return {
    impulse: { x: impulseX, y: BARREL_MASS * up, z: impulseZ },
    point: {
      x: barrelPosition.x,
      y: barrelPosition.y + BARREL_HIT_LEVER,
      z: barrelPosition.z,
    },
    torqueImpulse: { x: rollX, y: 0, z: rollZ },
    speedCap: computeBarrelSpeedCap(carSpeed),
  };
};

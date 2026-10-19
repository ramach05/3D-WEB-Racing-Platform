/**
 * Anti-stuck watchdog: the car is arcade-style and gets a target speed every frame via
 * setLinvel, but the solver cancels the forward component against an obstacle. Tires get an
 * impulse only on onCollisionEnter (and only once), so a tire pinned by the car against a
 * wall/other tires stops the car dead. The watchdog detects "pedal to the metal, no speed"
 * and continuously pushes obstacles out from under the bumper until the car moves again.
 */

/** Throttle below which sticking is not counted */
export const STUCK_THROTTLE_MIN = 0.5;
/** Target speed below which the car is nearly stationary anyway */
export const STUCK_TARGET_MIN_SPEED = 2;
/** Gap between target and actual forward speed, m/s; below it — not sticking */
export const STUCK_SPEED_GAP = 2;
/**
 * Continuous sticking before pushing starts, s. The threshold is well below a "full
 * stop": pushing starts at micro-stall, before the contact produces visible shaking
 * and freezing (the solver keeps the car in contact oscillation for longer than 0.4 s).
 */
export const STUCK_AFTER_SECONDS = 0.15;

/** Radius of the push sphere in front of the car nose, m */
export const RESCUE_RADIUS = 2.5;
/** Offset of the sphere center from the car center along the heading, m */
export const RESCUE_NOSE_OFFSET = 1.0;
/** Minimum "car -> obstacle" distance, m; closer — direction is degenerate */
export const RESCUE_MIN_DIST = 0.05;
/** Push acceleration, m/s^2: clearly above tire-on-asphalt friction (~8) */
export const RESCUE_BASE_ACCEL = 14;
/** Extra acceleration per car speed, m/s^2 per m/s */
export const RESCUE_CAR_ACCEL_SCALE = 2;
/** Lateral share of the push: moves the obstacle out from under the bumper instead of rolling it ahead */
export const RESCUE_SIDE_SHARE = 0.8;
/** Vertical share of the push: the obstacle rolls over instead of scraping along the ground */
export const RESCUE_UP_SHARE = 0.25;
/** Lateral offset tolerance, m; below it the push side defaults to the right of the heading */
export const RESCUE_SIDE_DEGENERATE_EPS = 0.05;

/** Vector in the road plane */
export type TAntiStuckVec2 = { x: number; z: number };

/** Signals for stuck detection */
export type TStuckProbe = {
  /** Throttle 0..1 */
  throttle: number;
  /** Handbrake 0..1 */
  handbrake: number;
  /** Target forward speed, m/s */
  targetForward: number;
  /** Actual forward speed, m/s */
  forwardSpeed: number;
  /** Whether the wheels have ground support */
  grounded: boolean;
};

/** Stuck: throttle held along the heading, grounded, but no acceleration builds up */
export const isStuckAgainstObstacle = ({
  throttle,
  handbrake,
  targetForward,
  forwardSpeed,
  grounded,
}: TStuckProbe): boolean =>
  grounded &&
  handbrake <= 0 &&
  throttle > STUCK_THROTTLE_MIN &&
  targetForward > STUCK_TARGET_MIN_SPEED &&
  targetForward - forwardSpeed > STUCK_SPEED_GAP;

/** Accumulates the stuck timer; resets to zero on recovery */
export const updateStuckTimer = (stuck: boolean, dt: number, timer: number): number =>
  stuck ? timer + dt : 0;

/** Active time exceeds STUCK_AFTER_SECONDS — time to push out */
export const isRescueActive = (timer: number): boolean => timer >= STUCK_AFTER_SECONDS;

/** Parameters for pushing out a single obstacle */
export type TRescueStrike = {
  /** Car center in the road plane */
  carPosition: TAntiStuckVec2;
  /** Unit heading vector of the car */
  carForward: TAntiStuckVec2;
  /** Obstacle center in the road plane */
  obstaclePosition: TAntiStuckVec2;
  /** Obstacle mass, kg */
  obstacleMass: number;
  /** Car speed (or target speed), m/s */
  carSpeed: number;
  /** Simulation step, s */
  dt: number;
};

/** Push-out impulse, N·s */
export type TRescueImpulse = { x: number; y: number; z: number };

/**
 * Push-out impulse per frame: force (mass × acceleration) multiplied by dt, so continuous
 * holding is damped only by the obstacle's contacts and friction. Direction — "from car to
 * obstacle" with a lateral escape from under the bumper. An obstacle behind the car cannot
 * cause sticking -> null.
 */
export const computeRescueImpulse = ({
  carPosition,
  carForward,
  obstaclePosition,
  obstacleMass,
  carSpeed,
  dt,
}: TRescueStrike): TRescueImpulse | null => {
  let dx = obstaclePosition.x - carPosition.x;
  let dz = obstaclePosition.z - carPosition.z;
  const dist = Math.hypot(dx, dz);
  if (dist < RESCUE_MIN_DIST || dt <= 0) {
    return null;
  }
  dx /= dist;
  dz /= dist;

  const fLen = Math.hypot(carForward.x, carForward.z) || 1;
  const fx = carForward.x / fLen;
  const fz = carForward.z / fLen;
  if (dx * fx + dz * fz <= 0) {
    return null;
  }

  // lateral offset of the obstacle from the heading axis — escape to the same side
  const rightX = fz;
  const rightZ = -fx;
  const lateral = dx * rightX + dz * rightZ;
  const sideSign = Math.abs(lateral) < RESCUE_SIDE_DEGENERATE_EPS ? 1 : Math.sign(lateral);

  const accel = RESCUE_BASE_ACCEL + RESCUE_CAR_ACCEL_SCALE * Math.max(0, carSpeed);
  const escapeX = dx + rightX * sideSign * RESCUE_SIDE_SHARE;
  const escapeZ = dz + rightZ * sideSign * RESCUE_SIDE_SHARE;
  const escape = Math.hypot(escapeX, escapeZ) || 1;
  const magnitude = obstacleMass * accel * dt;

  return {
    x: (magnitude * escapeX) / escape,
    y: magnitude * RESCUE_UP_SHARE,
    z: (magnitude * escapeZ) / escape,
  };
};

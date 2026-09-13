export const VEHICLE_MAX_SPEED = 30;
export const VEHICLE_REVERSE_MAX = 10;
export const VEHICLE_LOW_SPEED_STEER = 1.02;
export const VEHICLE_HIGH_SPEED_STEER = 0.58;
/** До этой скорости (м/с) руль набирает силу; на месте — 0 */
export const VEHICLE_STEER_ENGAGE_SPEED = 1.4;

/**
 * Целевая угловая скорость (рад/с) при полной силе руля (strength=1).
 * Согласовано с прежним равновесием на 60 FPS: 5.4 * 12 / 15.
 */
export const VEHICLE_STEER_YAW_RATE = 4.32;

/**
 * Скорость сходимости yaw к цели (1/с).
 * Согласовано с прежним `angvel * 0.75` на кадре 1/60: -ln(0.75)*60.
 */
export const VEHICLE_YAW_FOLLOW = -Math.log(0.75) * 60;

/**
 * Затухание yaw на месте (1/с).
 * Согласовано с прежним `angvel * 0.12` на кадре 1/60: -ln(0.12)*60.
 */
export const VEHICLE_YAW_STOP = -Math.log(0.12) * 60;

/** Сила руля: 0 на месте, сильнее на малой скорости, слабее к максимуму */
export const computeSteerStrength = (forwardSpeed: number): number => {
  const absSpeed = Math.abs(forwardSpeed);
  if (absSpeed < 0.12) {
    return 0;
  }
  const engage = Math.min(1, absSpeed / VEHICLE_STEER_ENGAGE_SPEED);
  const speedRatio = Math.min(1, absSpeed / VEHICLE_MAX_SPEED);
  const curve =
    VEHICLE_LOW_SPEED_STEER + (VEHICLE_HIGH_SPEED_STEER - VEHICLE_LOW_SPEED_STEER) * speedRatio;
  return curve * engage;
};

/**
 * Новый yaw (рад/с), независимый от FPS.
 * Раньше `* 0.75` за кадр на тяжёлых сценах (Night City) давал почти вдвое больший отклик.
 */
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

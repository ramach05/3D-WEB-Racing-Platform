export const VEHICLE_MAX_SPEED = 30;
export const VEHICLE_REVERSE_MAX = 10;
export const VEHICLE_LOW_SPEED_STEER = 1.02;
export const VEHICLE_HIGH_SPEED_STEER = 0.58;
/** До этой скорости (м/с) руль набирает силу; на месте — 0 */
export const VEHICLE_STEER_ENGAGE_SPEED = 1.4;

/** Сила руля: 0 на месте, сильнее на малой скорости, слабее к максимуму */
export const computeSteerStrength = (forwardSpeed: number): number => {
  const absSpeed = Math.abs(forwardSpeed);
  if (absSpeed < 0.12) {
    return 0;
  }
  const engage = Math.min(1, absSpeed / VEHICLE_STEER_ENGAGE_SPEED);
  const speedRatio = Math.min(1, absSpeed / VEHICLE_MAX_SPEED);
  const curve =
    VEHICLE_LOW_SPEED_STEER +
    (VEHICLE_HIGH_SPEED_STEER - VEHICLE_LOW_SPEED_STEER) * speedRatio;
  return curve * engage;
};

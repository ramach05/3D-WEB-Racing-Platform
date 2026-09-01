export const VEHICLE_MAX_SPEED = 30;
export const VEHICLE_REVERSE_MAX = 10;
export const VEHICLE_LOW_SPEED_STEER = 0.92;
export const VEHICLE_HIGH_SPEED_STEER = 0.42;

/** Сила руля: выше на малой скорости, плавно слабеет к максимуму */
export const computeSteerStrength = (forwardSpeed: number): number => {
  const speedRatio = Math.min(1, Math.abs(forwardSpeed) / VEHICLE_MAX_SPEED);
  return (
    VEHICLE_LOW_SPEED_STEER +
    (VEHICLE_HIGH_SPEED_STEER - VEHICLE_LOW_SPEED_STEER) * speedRatio
  );
};

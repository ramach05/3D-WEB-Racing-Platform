/** Half length of the car footprint along the heading (capsule collider, half Z) */
export const CAR_UNDER_HALF_LENGTH = 1.65;
/** Half width of the car footprint across the heading (capsule collider, radius) */
export const CAR_UNDER_HALF_WIDTH = 0.82;

/** Car and obstacle poses in world coordinates */
export type TUnderCarProbe = {
  carPosition: { x: number; y: number; z: number };
  /** Car heading in the road plane (not normalized) */
  carForward: { x: number; z: number };
  obstaclePosition: { x: number; y: number; z: number };
};

/** Obstacle under the body: the car rolls over it, it must not be pinned to the ground */
export const isObstacleUnderCar = ({
  carPosition,
  carForward,
  obstaclePosition,
}: TUnderCarProbe): boolean => {
  const fLen = Math.hypot(carForward.x, carForward.z);
  if (fLen < 1e-6) {
    return false;
  }
  const fx = carForward.x / fLen;
  const fz = carForward.z / fLen;
  const dx = obstaclePosition.x - carPosition.x;
  const dz = obstaclePosition.z - carPosition.z;
  const along = dx * fx + dz * fz;
  // right heading axis = (fz, -fx)
  const lateral = dx * fz - dz * fx;
  return (
    Math.abs(lateral) <= CAR_UNDER_HALF_WIDTH &&
    Math.abs(along) <= CAR_UNDER_HALF_LENGTH &&
    obstaclePosition.y < carPosition.y
  );
};

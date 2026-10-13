/** Половина длины подошвы машины по курсу (капсульный коллайдер, half Z) */
export const CAR_UNDER_HALF_LENGTH = 1.65;
/** Половина ширины подошвы машины поперек курса (капсульный коллайдер, radius) */
export const CAR_UNDER_HALF_WIDTH = 0.82;

/** Позы машины и препятствия в мировых координатах */
export type TUnderCarProbe = {
  carPosition: { x: number; y: number; z: number };
  /** Курс машины в плоскости дороги (не нормирован) */
  carForward: { x: number; z: number };
  obstaclePosition: { x: number; y: number; z: number };
};

/** Препятствие под кузовом: машина перекатывается через него, прижимать к земле нельзя */
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
  // правая ось курса = (fz, -fx)
  const lateral = dx * fz - dz * fx;
  return (
    Math.abs(lateral) <= CAR_UNDER_HALF_WIDTH &&
    Math.abs(along) <= CAR_UNDER_HALF_LENGTH &&
    obstaclePosition.y < carPosition.y
  );
};

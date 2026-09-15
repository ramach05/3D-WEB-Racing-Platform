/** Целевая длина кузова по капсуле (2 × COLLIDER_HALF_Z) */
export const VEHICLE_TARGET_LENGTH = 3.3;
/** Целевая ширина кузова по капсуле (2 × COLLIDER_HALF_X) */
export const VEHICLE_TARGET_WIDTH = 1.64;

export type TVehicleBounds = {
  /** Габариты AABB модели */
  size: { x: number; y: number; z: number };
  /** Минимум AABB */
  min: { x: number; y: number; z: number };
  /** Центр AABB */
  center: { x: number; y: number; z: number };
};

export type TVehicleFit = {
  /** Равномерный масштаб под целевую длину */
  scale: number;
  /** Смещение: центр xz в 0, низ колёс на y=0 */
  offset: { x: number; y: number; z: number };
};

/**
 * Считает scale/offset, чтобы длина модели ≈ targetLength,
 * низ AABB лежал на y=0, центр xz — в начале координат.
 */
export const computeVehicleFit = (
  bounds: TVehicleBounds,
  targetLength: number = VEHICLE_TARGET_LENGTH,
): TVehicleFit => {
  const length = Math.max(bounds.size.z, 1e-6);
  const scale = targetLength / length;
  return {
    scale,
    offset: {
      x: -bounds.center.x * scale,
      y: -bounds.min.y * scale,
      z: -bounds.center.z * scale,
    },
  };
};

/** Ширина после fit (для проверки против капсулы) */
export const fittedWidth = (bounds: TVehicleBounds, fit: TVehicleFit): number =>
  bounds.size.x * fit.scale;

/** Длина после fit */
export const fittedLength = (bounds: TVehicleBounds, fit: TVehicleFit): number =>
  bounds.size.z * fit.scale;

/** Target body length per capsule (2 × COLLIDER_HALF_Z) */
export const VEHICLE_TARGET_LENGTH = 3.3;
/** Target body width per capsule (2 × COLLIDER_HALF_X) */
export const VEHICLE_TARGET_WIDTH = 1.64;

export type TVehicleBounds = {
  /** Model AABB dimensions */
  size: { x: number; y: number; z: number };
  /** AABB minimum */
  min: { x: number; y: number; z: number };
  /** AABB center */
  center: { x: number; y: number; z: number };
};

export type TVehicleFit = {
  /** Uniform scale for the target length */
  scale: number;
  /** Offset: center xz at 0, wheel bottoms at y=0 */
  offset: { x: number; y: number; z: number };
};

/** Computes scale/offset so model length ≈ targetLength, AABB bottom rests on y=0, center xz at the origin. */
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

/** Width after fit (for checking against the capsule) */
export const fittedWidth = (bounds: TVehicleBounds, fit: TVehicleFit): number =>
  bounds.size.x * fit.scale;

/** Length after fit */
export const fittedLength = (bounds: TVehicleBounds, fit: TVehicleFit): number =>
  bounds.size.z * fit.scale;

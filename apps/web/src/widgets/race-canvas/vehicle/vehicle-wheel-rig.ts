import { type Quaternion, Vector3, type Mesh, type Object3D } from 'three';

/** Ackermann difference: the inner wheel turns more than the outer one. 0 = same angle, ~0.2 = noticeable turn geometry. */
export const ACKERMANN_RATIO = 0.22;

const WORLD_UP = new Vector3(0, 1, 0);
const tmpFromXZ = new Vector3();

/** World-up in the wheel parent's local axes. On CarConcept wheels hang off BodyUnderside (−90° around X), so the parent Y ≠ vertical. */
export const computeSteerAxisLocal = (parentWorldQuaternion: Quaternion): Vector3 =>
  WORLD_UP.clone().applyQuaternion(parentWorldQuaternion.clone().invert()).normalize();

/**
 * World tire axis → local axes of the rotation pivot (wheel's parent).
 *
 * The spinPivot.quaternion rotation runs in the pivot's local frame, which
 * coincides with the parent's frame (steer/align are identity rotations, so the frame
 * does not depend on toe alignment). Keeping the world axis from measureWheelAxle is not
 * an option: on models whose wheels hang under a rotated parent (CarConcept's BodyUnderside,
 * −90° around X), the world axis points "the wrong way" in the local frame — the wheel spins
 * around a foreign axis (chaotic rotation). Sedan/pickup never suffered only because
 * their pivots hang on the root with an identity rotation.
 */
export const computeAxleLocal = (axleWorld: Vector3, parentWorldQuaternion: Quaternion): Vector3 =>
  axleWorld.clone().applyQuaternion(parentWorldQuaternion.clone().invert()).normalize();

/** Angle around the vertical so the tire axis lies in the X plane (no toe). CarConcept has ~30° toe on front wheels in the authored pose. */
export const computeToeYawCorrection = (axleWorld: Vector3): number => {
  tmpFromXZ.set(axleWorld.x, 0, axleWorld.z);
  if (tmpFromXZ.lengthSq() < 1e-8) {
    return 0;
  }
  tmpFromXZ.normalize();
  const desiredX = Math.sign(axleWorld.x || 1);
  // atan2(cross·Y, dot) from the current XZ to (±1, 0, 0)
  return Math.atan2(tmpFromXZ.z * desiredX, tmpFromXZ.x * desiredX);
};

/** Ackermann: the inner wheel turns more */
export const computeAckermannScale = (steerAngle: number, sideSign: number): number => {
  if (steerAngle === 0 || sideSign === 0) {
    return 1;
  }
  return 1 + ACKERMANN_RATIO * Math.sign(steerAngle) * sideSign;
};

/* ------------------------------------------------------------------ *
 * Tire axis measurement from geometry
 * ------------------------------------------------------------------ */

/**
 * On "dumb" models (hatchback etc.) wheel nodes have identity transforms:
 * rotation (toe) is baked right into the geometry vertices. The axis can't be read
 * from a quat — so we measure by points: axis = direction of minimal horizontal spread.
 */
const MAX_WHEEL_AXLE_POINTS = 4096;
const tmpSampled = new Vector3();

const isMeshObject = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true;

/** Collects a sample of world geometry points under node (stride ≤ maxPoints). */
export const sampleWheelWorldPoints = (
  wheel: Object3D,
  maxPoints = MAX_WHEEL_AXLE_POINTS,
): Vector3[] => {
  const out: Vector3[] = [];
  let budget = maxPoints;
  wheel.updateWorldMatrix(true, true);
  wheel.traverse((object) => {
    if (!isMeshObject(object) || budget <= 0) {
      return;
    }
    // Procedural Juke TireFill — the axis is already aligned; it must not overwrite authored toe
    if (object.name.endsWith('_TireFill') || !object.visible) {
      return;
    }
    const position = object.geometry.getAttribute('position');
    if (!position) {
      return;
    }
    const count = position.count;
    const stride = Math.max(1, Math.ceil(count / budget));
    for (let i = 0; i < count && budget > 0; i += stride, budget -= 1) {
      out.push(
        tmpSampled.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld).clone(),
      );
    }
  });
  return out;
};

/** Length of the point projection onto a horizontal axis at angle deg (degrees). */
const projectedWidth = (pts: readonly Vector3[], cx: number, cz: number, deg: number): number => {
  const t = (deg * Math.PI) / 180;
  const a = Math.cos(t);
  const b = Math.sin(t);
  let mn = Number.POSITIVE_INFINITY;
  let mx = Number.NEGATIVE_INFINITY;
  for (const p of pts) {
    const proj = a * (p.x - cx) + b * (p.z - cz);
    if (proj < mn) {
      mn = proj;
    }
    if (proj > mx) {
      mx = proj;
    }
  }
  return mx - mn;
};

/** Coarse-to-fine search for the minimal projection-width angle within [from, to]. */
const bestYaw = (
  pts: readonly Vector3[],
  cx: number,
  cz: number,
  from: number,
  to: number,
  step: number,
): { yaw: number; width: number } => {
  let yaw = from;
  let width = Number.POSITIVE_INFINITY;
  for (let d = from; d <= to + step * 0.5; d += step) {
    const w = projectedWidth(pts, cx, cz, d);
    if (w < width) {
      width = w;
      yaw = d;
    }
  }
  return { yaw, width };
};

/**
 * Measured tire axis in the horizontal plane (minimal geometry spread,
 * i.e. the wheel's "thinness" direction). Always returned with x ≥ 0 — that way right
 * and left sides spin forward with a shared spinAngle (X×Y = Z the same for both).
 * Fallback (1, 0, 0) when there is too little geometry or it doesn't look like a wheel (not thin).
 */
export const measureWheelAxle = (wheel: Object3D, maxPoints = MAX_WHEEL_AXLE_POINTS): Vector3 => {
  const pts = sampleWheelWorldPoints(wheel, maxPoints);
  if (pts.length < 8) {
    return new Vector3(1, 0, 0);
  }
  let cx = 0;
  let cz = 0;
  for (const p of pts) {
    cx += p.x;
    cz += p.z;
  }
  cx /= pts.length;
  cz /= pts.length;

  const coarse = bestYaw(pts, cx, cz, -90, 90, 5);
  const fine = bestYaw(pts, cx, cz, coarse.yaw - 6, coarse.yaw + 6, 0.5);

  // Diameter (perpendicular to the axis): a check that the "axis" really is thin.
  const diameter = projectedWidth(pts, cx, cz, fine.yaw + 90);
  if (
    !Number.isFinite(fine.width) ||
    fine.width <= 1e-4 ||
    diameter <= 1e-4 ||
    fine.width / diameter > 0.6
  ) {
    return new Vector3(1, 0, 0);
  }
  const rad = (fine.yaw * Math.PI) / 180;
  return new Vector3(Math.cos(rad), 0, Math.sin(rad)).normalize();
};

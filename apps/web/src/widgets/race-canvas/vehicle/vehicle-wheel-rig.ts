import { Quaternion, Vector3 } from 'three';

/**
 * Разница Ackermann: внутреннее колесо крутится сильнее наружного.
 * 0 = одинаковый угол, ~0.2 — заметная геометрия поворота.
 */
export const ACKERMANN_RATIO = 0.22;

const WORLD_UP = new Vector3(0, 1, 0);
const tmpFromXZ = new Vector3();

/**
 * World-up в локальных осях родителя колеса.
 * У CarConcept колёса висят на BodyUnderside (−90° по X), поэтому родительский Y ≠ вертикаль.
 */
export const computeSteerAxisLocal = (parentWorldQuaternion: Quaternion): Vector3 =>
  WORLD_UP.clone().applyQuaternion(parentWorldQuaternion.clone().invert()).normalize();

/**
 * Угол вокруг вертикали, чтобы ось шины лежала в плоскости X (без toe).
 * CarConcept имеет ~30° toe на передних колёсах в authored-позе.
 */
export const computeToeYawCorrection = (axleWorld: Vector3): number => {
  tmpFromXZ.set(axleWorld.x, 0, axleWorld.z);
  if (tmpFromXZ.lengthSq() < 1e-8) {
    return 0;
  }
  tmpFromXZ.normalize();
  const desiredX = Math.sign(axleWorld.x || 1);
  // atan2(cross·Y, dot) от текущего XZ к (±1, 0, 0)
  return Math.atan2(tmpFromXZ.z * desiredX, tmpFromXZ.x * desiredX);
};

/** Ackermann: внутреннее колесо крутится сильнее */
export const computeAckermannScale = (steerAngle: number, sideSign: number): number => {
  if (steerAngle === 0 || sideSign === 0) {
    return 1;
  }
  return 1 + ACKERMANN_RATIO * Math.sign(steerAngle) * sideSign;
};

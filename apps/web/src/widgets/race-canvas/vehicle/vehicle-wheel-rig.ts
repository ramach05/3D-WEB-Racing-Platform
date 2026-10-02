import { type Quaternion, Vector3, type Mesh, type Object3D } from 'three';

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
 * Мировая ось шины → локальные оси пивота вращения (родителя колеса).
 *
 * Вращение spinPivot.quaternion выполняется в локальном фрейме пивота, который
 * совпадает с фреймом родителя (steer/align — тождественные повороты, поэтому фрейм
 * не зависит от выравнивания toe). Мировую ось из measureWheelAxle оставлять нельзя:
 * у моделей, чьи колёса висят под повёрнутым родителем (BodyUnderside у CarConcept,
 * −90° по X), мировая ось в локальном фрейме направлена «не туда» — колесо крутится
 * вокруг чужой оси (хаотичное вращение). Sedan/pickup не страдали лишь потому, что
 * их пивоты висят на корне с identity-поворотом.
 */
export const computeAxleLocal = (
  axleWorld: Vector3,
  parentWorldQuaternion: Quaternion,
): Vector3 =>
  axleWorld.clone().applyQuaternion(parentWorldQuaternion.clone().invert()).normalize();

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

/* ------------------------------------------------------------------ *
 * Измерение оси шины по геометрии
 * ------------------------------------------------------------------ */

/**
 * У моделей-«глухарей» (hatchback и т.п.) узлы колёс имеют identity-трансформы:
 * поворот (toe) запечён прямо в вершины геометрии. Узнать ось из quat нельзя —
 * поэтому меряем по точкам: ось = направление минимального разброса в горизонтали.
 */
const MAX_WHEEL_AXLE_POINTS = 4096;
const tmpSampled = new Vector3();

const isMeshObject = (object: Object3D): object is Mesh =>
  (object as Mesh).isMesh === true;

/** Собирает выборку мировых точек геометрии под node (stride ≤ maxPoints). */
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
    // Procedural Juke TireFill — ось уже выровнена; не должна затирать authored toe
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
      out.push(tmpSampled.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld).clone());
    }
  });
  return out;
};

/** Длина проекции точек на горизонтальную ось под углом deg (градусы). */
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

/** Грубо-точный поиск угла минимальной ширины проекции в диапазоне [from, to]. */
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
 * Замеренная ось шины в горизонтальной плоскости (минимальный разброс геометрии,
 * т.е. направление «тонкости» колеса). Всегда возвращается с x ≥ 0 — так правая
 * и левая сторона крутятся общим spinAngle вперёд (X×Y = Z одинаково для обеих).
 * Fallback (1, 0, 0), когда геометрии мало либо она не похожа на колесо (не тонкая).
 */
export const measureWheelAxle = (
  wheel: Object3D,
  maxPoints = MAX_WHEEL_AXLE_POINTS,
): Vector3 => {
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

  // Диаметр (перпендикуляр оси): контроль, что «ось» правда тонкая.
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

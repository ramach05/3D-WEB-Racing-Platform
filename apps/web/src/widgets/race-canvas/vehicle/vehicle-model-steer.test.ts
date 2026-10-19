import { Quaternion, Vector3 } from 'three';
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import {
  computeAckermannScale,
  computeAxleLocal,
  computeSteerAxisLocal,
  computeToeYawCorrection,
  measureWheelAxle,
} from '@/widgets/race-canvas/vehicle/vehicle-wheel-rig';

describe('computeSteerAxisLocal', () => {
  it('maps world up to parent +Z when parent is rotated −90° around X (BodyUnderside)', () => {
    // quat (−sin45, 0, 0, cos45) = −90° around X
    const parentQ = new Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);
    const axis = computeSteerAxisLocal(parentQ);
    expect(axis.x).toBeCloseTo(0, 5);
    expect(axis.y).toBeCloseTo(0, 5);
    expect(axis.z).toBeCloseTo(1, 5);
  });

  it('keeps world up when parent has identity rotation', () => {
    const axis = computeSteerAxisLocal(new Quaternion());
    expect(axis.x).toBeCloseTo(0, 5);
    expect(axis.y).toBeCloseTo(1, 5);
    expect(axis.z).toBeCloseTo(0, 5);
  });
});

describe('computeToeYawCorrection', () => {
  it('returns ~30° for CarConcept front-wheel axle (0.866, 0, 0.5)', () => {
    const axle = new Vector3(Math.sqrt(3) / 2, 0, 0.5);
    const yaw = computeToeYawCorrection(axle);
    expect(yaw).toBeCloseTo(Math.PI / 6, 5);
  });

  it('returns 0 when axle already lies on ±X', () => {
    expect(computeToeYawCorrection(new Vector3(1, 0, 0))).toBeCloseTo(0, 5);
    expect(computeToeYawCorrection(new Vector3(-1, 0, 0))).toBeCloseTo(0, 5);
  });
});

describe('computeAckermannScale', () => {
  it('boosts the inner wheel and softens the outer', () => {
    // steer > 0 (left): left (+1) is inner
    expect(computeAckermannScale(0.5, 1)).toBeGreaterThan(1);
    expect(computeAckermannScale(0.5, -1)).toBeLessThan(1);
    // steer < 0 (right): right (−1) is inner
    expect(computeAckermannScale(-0.5, -1)).toBeGreaterThan(1);
    expect(computeAckermannScale(-0.5, 1)).toBeLessThan(1);
  });

  it('is 1 at zero steer', () => {
    expect(computeAckermannScale(0, 1)).toBe(1);
    expect(computeAckermannScale(0, -1)).toBe(1);
  });
});

/** Строит «запеченное» колесо: ось цилиндра (тонкая) направлена по (cos yaw, 0, sin yaw). */
const makeWheel = (yawDeg: number, wheelX = 0, wheelZ = 0): Group => {
  const geometry = new CylinderGeometry(0.35, 0.35, 0.25, 24);
  geometry.rotateZ(Math.PI / 2); // ось Y → −X
  // ось → (cos yaw, 0, sin yaw): toe запекаем прямо в вершины (как в GLB-«глухарях»)
  geometry.rotateY(Math.PI - (yawDeg * Math.PI) / 180);
  const group = new Group();
  const mesh = new Mesh(geometry, new MeshStandardMaterial());
  mesh.position.set(wheelX, 0.5, wheelZ);
  group.add(mesh);
  return group;
};

const bearingDeg = (axle: { x: number; z: number }): number =>
  (Math.atan2(axle.z, axle.x) * 180) / Math.PI;

describe('measureWheelAxle', () => {
  it('detects a straight baked axle (yaw 0°) as +X with x ≥ 0', () => {
    const axle = measureWheelAxle(makeWheel(0));
    expect(axle.x).toBeGreaterThan(0);
    expect(axle.y).toBeCloseTo(0, 5);
    expect(bearingDeg(axle)).toBeCloseTo(0, 1);
  });

  it.each([8, -12])('detects baked toe of %i° (±0.8°)', (yawDeg) => {
    const axle = measureWheelAxle(makeWheel(yawDeg, 0, 0));
    expect(axle.x).toBeGreaterThan(0);
    expect(bearingDeg(axle) - yawDeg).toBeLessThan(0.8);
    expect(bearingDeg(axle) - yawDeg).toBeGreaterThan(-0.8);
  });

  it('maps a right-side axle (near −X, 178°) to the +X representative', () => {
    const axle = measureWheelAxle(makeWheel(178, 2.5, 0));
    expect(axle.x).toBeGreaterThan(0);
    expect(Math.abs(bearingDeg(axle))).toBeLessThan(4);
  });

  it('is offset-independent on a car-like wheel position', () => {
    const a = measureWheelAxle(makeWheel(6, 0, 0));
    const b = measureWheelAxle(makeWheel(6, 2.5, 3.2));
    expect(bearingDeg(a)).toBeCloseTo(bearingDeg(b), 1);
  });

  it('straightens via computeToeYawCorrection (align = +bearing, three Y-rotation)', () => {
    const wheel = makeWheel(8);
    const axle = measureWheelAxle(wheel);
    const yawCorr = computeToeYawCorrection(axle);
    // Коррекция = азимут оси: three крутит +X к −Z, поэтому R_up(+bearing) приводит ось к +X.
    expect(yawCorr).toBeCloseTo((8 * Math.PI) / 180, 1);
    // Композиция как в buildWheelRig: setFromAxisAngle(up, yawCorr) выпрямляет ось.
    const aligned = axle.clone().applyAxisAngle(new Vector3(0, 1, 0), yawCorr);
    expect(Math.abs(bearingDeg(aligned))).toBeLessThan(0.8);
  });

  it('falls back to (1,0,0) on empty geometry', () => {
    const axle = measureWheelAxle(new Group());
    expect(axle.x).toBe(1);
    expect(axle.y).toBe(0);
    expect(axle.z).toBe(0);
  });

  it('falls back to (1,0,0) on non-thin (cube) geometry', () => {
    const group = new Group();
    group.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
    const axle = measureWheelAxle(group);
    expect(axle.x).toBe(1);
    expect(axle.y).toBe(0);
    expect(axle.z).toBe(0);
  });
});

describe('computeAxleLocal', () => {
  it('keeps the axle as-is when the parent has identity rotation (sedan/pickup case)', () => {
    const axle = new Vector3(0.87, 0, 0.5).normalize();
    const local = computeAxleLocal(axle, new Quaternion());
    expect(local.x).toBeCloseTo(axle.x, 5);
    expect(local.y).toBeCloseTo(axle.y, 5);
    expect(local.z).toBeCloseTo(axle.z, 5);
  });

  it('round-trips a non-trivial world axle under BodyUnderside (−90° X)', () => {
    // −90° вокруг X: тот же quat, что у родителя колес CarConcept
    const parentQ = new Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);
    // ось вдоль Z ловит «забытый» inverse: без него локальная ось остается мировым (0,0,1),
    // и мировая ось вращения после пивота уезжает в (0,±1,0) — spin не совпадает с осью шины.
    const axleWorld = new Vector3(0, 0, 1);
    const local = computeAxleLocal(axleWorld, parentQ);
    expect(local.x).toBeCloseTo(0, 5);
    expect(local.y).toBeCloseTo(-1, 5);
    expect(local.z).toBeCloseTo(0, 5);
    // а в мировых осях спин идет ровно вокруг исходной оси
    const worldUsed = local.clone().applyQuaternion(parentQ).normalize();
    expect(Math.abs(worldUsed.dot(axleWorld))).toBeCloseTo(1, 5);
  });

  it('spins about the measured world axle at any angle under a rotated parent (120° stability)', () => {
    const parentQ = new Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);
    const axleWorld = new Vector3(0.3, 0, 0.95).normalize();
    const local = computeAxleLocal(axleWorld, parentQ);
    for (const deg of [0, 30, 60, 90, 120]) {
      // ось поворота в мировых осях не зависит от угла и совпадает с осью шины
      const worldAxis = local.clone().applyQuaternion(parentQ).normalize();
      expect(Math.abs(worldAxis.dot(axleWorld))).toBeCloseTo(1, 6);
      void deg;
    }
  });
});

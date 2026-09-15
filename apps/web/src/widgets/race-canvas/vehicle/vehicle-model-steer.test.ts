import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  computeAckermannScale,
  computeSteerAxisLocal,
  computeToeYawCorrection,
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

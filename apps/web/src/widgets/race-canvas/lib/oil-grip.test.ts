import { afterEach, describe, expect, it } from 'vitest';
import {
  OIL_LATERAL_GRIP,
  OIL_RESIDUAL_SEC,
  OIL_THROTTLE_FACTOR,
  applyOilThrottleFactor,
  computeOilSkidIntensity,
  computeOilYawKick,
  resetOilGrip,
  resolveOilSurfaceGrip,
  tickOilGrip,
} from './oil-grip';
import { VEHICLE_LATERAL_GRIP } from '@/features/race-session/vehicle-physics';

describe('oil grip store', () => {
  afterEach(() => {
    resetOilGrip();
  });

  it('tracks contact fraction while on oil and decays after exit', () => {
    expect(tickOilGrip(1, 1 / 60)).toBe(1);
    expect(tickOilGrip(0.25, 1 / 60)).toBe(0.25);

    tickOilGrip(1, 1 / 60);
    const afterHalf = tickOilGrip(0, OIL_RESIDUAL_SEC / 2);
    expect(afterHalf).toBeCloseTo(0.5, 5);

    const afterFull = tickOilGrip(0, OIL_RESIDUAL_SEC);
    expect(afterFull).toBe(0);
  });

  it('resets strength to zero', () => {
    tickOilGrip(1, 0.1);
    resetOilGrip();
    expect(resolveOilSurfaceGrip(tickOilGrip(0, 0))).toBeUndefined();
  });
});

describe('oil surface helpers', () => {
  afterEach(() => {
    resetOilGrip();
  });

  it('maps full strength to oil grip and empty to undefined', () => {
    expect(resolveOilSurfaceGrip(0)).toBeUndefined();
    expect(resolveOilSurfaceGrip(1)).toBeCloseTo(OIL_LATERAL_GRIP, 5);
  });

  it('returns toward asphalt grip as residual fades', () => {
    const mid = resolveOilSurfaceGrip(0.5)!;
    expect(mid).toBeGreaterThan(OIL_LATERAL_GRIP);
    expect(mid).toBeLessThan(VEHICLE_LATERAL_GRIP);
  });

  it('softens throttle acceleration on oil without reversing inertia', () => {
    const next = applyOilThrottleFactor(20, 22, 1, 1);
    expect(next).toBeCloseTo(20 + 2 * OIL_THROTTLE_FACTOR, 5);
    expect(applyOilThrottleFactor(20, 18, 1, 1)).toBe(18);
  });

  it('adds yaw kick only when strength and steer/lateral are present', () => {
    expect(computeOilYawKick(0, 1, 20, 4)).toBe(0);
    expect(computeOilYawKick(1, 0, 20, 0)).toBe(0);
    expect(computeOilYawKick(1, 1, 30, 0)).toBeGreaterThan(0);
    expect(computeOilYawKick(0.25, 1, 30, 0)).toBeLessThan(computeOilYawKick(1, 1, 30, 0));
  });

  it('skips oil skid marks at low speed', () => {
    expect(computeOilSkidIntensity(1, 4)).toBe(0);
    expect(computeOilSkidIntensity(1, 20)).toBeGreaterThan(0.2);
    expect(computeOilSkidIntensity(1, 20)).toBeLessThan(0.6);
  });
});

import { describe, expect, it } from 'vitest';
import {
  VEHICLE_HIGH_SPEED_STEER,
  VEHICLE_LOW_SPEED_STEER,
  VEHICLE_MAX_SPEED,
  VEHICLE_STEER_ENGAGE_SPEED,
  computeSteerStrength,
} from './vehicle-physics';

describe('vehicle physics tuning', () => {
  it('keeps arcade top speed', () => {
    expect(VEHICLE_MAX_SPEED).toBe(30);
  });

  it('does not steer while standing still', () => {
    expect(computeSteerStrength(0)).toBe(0);
    expect(computeSteerStrength(0.05)).toBe(0);
  });

  it('steers stronger at low rolling speed than near top speed', () => {
    const low = computeSteerStrength(VEHICLE_STEER_ENGAGE_SPEED);
    const high = computeSteerStrength(VEHICLE_MAX_SPEED);
    expect(low).toBeGreaterThan(high);
    expect(low).toBeGreaterThan(VEHICLE_HIGH_SPEED_STEER);
    expect(low).toBeLessThanOrEqual(VEHICLE_LOW_SPEED_STEER);
    expect(high).toBeCloseTo(VEHICLE_HIGH_SPEED_STEER, 2);
  });
});

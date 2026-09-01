import { describe, expect, it } from 'vitest';
import {
  VEHICLE_HIGH_SPEED_STEER,
  VEHICLE_LOW_SPEED_STEER,
  VEHICLE_MAX_SPEED,
  computeSteerStrength,
} from './vehicle-physics';

describe('vehicle physics tuning', () => {
  it('caps top speed at 30 m/s', () => {
    expect(VEHICLE_MAX_SPEED).toBe(30);
  });

  it('steers stronger at low speed than near top speed', () => {
    const low = computeSteerStrength(0);
    const high = computeSteerStrength(VEHICLE_MAX_SPEED);
    expect(low).toBeGreaterThan(high);
    expect(low).toBeCloseTo(VEHICLE_LOW_SPEED_STEER, 2);
    expect(high).toBeCloseTo(VEHICLE_HIGH_SPEED_STEER, 2);
  });
});

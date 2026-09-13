import { describe, expect, it } from 'vitest';
import {
  VEHICLE_HIGH_SPEED_STEER,
  VEHICLE_LOW_SPEED_STEER,
  VEHICLE_MAX_SPEED,
  VEHICLE_STEER_ENGAGE_SPEED,
  VEHICLE_STEER_YAW_RATE,
  computeSteerStrength,
  integrateSteerYaw,
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

  it('converges to the same yaw rate at 30fps and 60fps', () => {
    const strength = 1;
    const steer = 1;
    const sign = 1;

    let yaw60 = 0;
    for (let i = 0; i < 120; i += 1) {
      yaw60 = integrateSteerYaw(yaw60, steer, strength, sign, 1 / 60);
    }

    let yaw30 = 0;
    for (let i = 0; i < 60; i += 1) {
      yaw30 = integrateSteerYaw(yaw30, steer, strength, sign, 1 / 30);
    }

    expect(yaw60).toBeCloseTo(VEHICLE_STEER_YAW_RATE, 2);
    expect(yaw30).toBeCloseTo(VEHICLE_STEER_YAW_RATE, 2);
    expect(Math.abs(yaw60 - yaw30)).toBeLessThan(0.05);
  });
});

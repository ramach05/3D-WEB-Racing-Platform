import { describe, expect, it } from 'vitest';
import {
  HANDBRAKE_DECEL,
  HANDBRAKE_STEER_BOOST,
  HANDBRAKE_THROTTLE_FACTOR,
  VEHICLE_ACCEL,
  VEHICLE_HIGH_SPEED_STEER,
  VEHICLE_LATERAL_GRIP,
  VEHICLE_LOW_SPEED_STEER,
  VEHICLE_MAX_SPEED,
  VEHICLE_STEER_ENGAGE_SPEED,
  VEHICLE_STEER_YAW_RATE,
  computeSteerStrength,
  dampLateralVelocity,
  integrateDriveForward,
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

  it('keeps crawl-speed steer soft so the car does not pivot in place', () => {
    const crawl = computeSteerStrength(1.2);
    const rolling = computeSteerStrength(VEHICLE_STEER_ENGAGE_SPEED);
    expect(crawl).toBeLessThan(rolling * 0.35);
    expect(crawl).toBeLessThan(0.2);
  });

  it('boosts steer strength while handbrake is held', () => {
    const base = computeSteerStrength(15, 0);
    const drifted = computeSteerStrength(15, 1);
    expect(drifted).toBeCloseTo(base * HANDBRAKE_STEER_BOOST, 5);
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

describe('handbrake longitudinal', () => {
  const dt = 1 / 60;

  it('slowly decelerates when handbrake and throttle are held together', () => {
    const speed = 20;
    const next = integrateDriveForward(speed, {
      throttle: 1,
      brake: 0,
      handbrake: 1,
      dt,
    });
    const expectedNet = VEHICLE_ACCEL * HANDBRAKE_THROTTLE_FACTOR - HANDBRAKE_DECEL;
    expect(expectedNet).toBeLessThan(0);
    expect(next).toBeLessThan(speed);
    expect(next).toBeCloseTo(speed + expectedNet * dt, 5);
  });

  it('decelerates toward zero with handbrake alone and does not reverse', () => {
    const next = integrateDriveForward(5, {
      throttle: 0,
      brake: 0,
      handbrake: 1,
      dt: 1,
    });
    expect(next).toBe(0);
  });

  it('keeps foot-brake behavior when brake is held', () => {
    const withBrake = integrateDriveForward(20, {
      throttle: 0,
      brake: 1,
      handbrake: 1,
      dt,
    });
    const brakeOnly = integrateDriveForward(20, {
      throttle: 0,
      brake: 1,
      handbrake: 0,
      dt,
    });
    expect(withBrake).toBeCloseTo(brakeOnly, 5);
  });
});

describe('handbrake lateral', () => {
  const dt = 1 / 60;
  const lateral = 8;

  it('damps lateral much less with handbrake than with normal grip', () => {
    const gripped = dampLateralVelocity(lateral, 0, 0, dt);
    const drifting = dampLateralVelocity(lateral, 1, 1, dt);
    expect(drifting).toBeGreaterThan(gripped);
    expect(gripped).toBeCloseTo(lateral * Math.exp(-VEHICLE_LATERAL_GRIP * dt), 5);
  });
});

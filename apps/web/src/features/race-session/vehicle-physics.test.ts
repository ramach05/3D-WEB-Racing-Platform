import { describe, expect, it } from 'vitest';
import {
  ANGLE_SMOOTH_MAX_RATE,
  computeGroundFollowVy,
  computeSlopePitchFromNormal,
  computeSteerStrength,
  dampLateralVelocity,
  HANDBRAKE_DECEL,
  HANDBRAKE_STEER_BOOST,
  HANDBRAKE_THROTTLE_FACTOR,
  integrateDriveForward,
  integrateSteerYaw,
  MAX_CLIMB_VY,
  smoothAngleToward,
  SLOPE_MAX_GRADE,
  VEHICLE_ACCEL,
  VEHICLE_HIGH_SPEED_STEER,
  VEHICLE_LATERAL_GRIP,
  VEHICLE_LOW_SPEED_STEER,
  VEHICLE_MAX_SPEED,
  VEHICLE_STEER_ENGAGE_SPEED,
  VEHICLE_STEER_YAW_RATE,
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

  it('decelerates reverse speed toward zero with handbrake alone', () => {
    const speed = -8;
    const next = integrateDriveForward(speed, {
      throttle: 0,
      brake: 0,
      handbrake: 1,
      dt,
    });
    expect(next).toBeGreaterThan(speed);
    expect(next).toBeLessThanOrEqual(0);
    expect(next).toBeCloseTo(speed + HANDBRAKE_DECEL * dt, 5);
  });

  it('prioritizes handbrake over foot-brake when both are held', () => {
    const withBoth = integrateDriveForward(20, {
      throttle: 0,
      brake: 1,
      handbrake: 1,
      dt,
    });
    const handbrakeOnly = integrateDriveForward(20, {
      throttle: 0,
      brake: 0,
      handbrake: 1,
      dt,
    });
    expect(withBoth).toBeCloseTo(handbrakeOnly, 5);
  });

  it('stops reverse when handbrake is held with brake (S+Space)', () => {
    const speed = -8;
    const next = integrateDriveForward(speed, {
      throttle: 0,
      brake: 1,
      handbrake: 1,
      dt,
    });
    expect(next).toBeGreaterThan(speed);
    expect(next).toBeLessThanOrEqual(0);
    expect(next).toBeCloseTo(speed + HANDBRAKE_DECEL * dt, 5);
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

  it('keeps more lateral slip when surfaceGrip is below asphalt grip', () => {
    const asphalt = dampLateralVelocity(lateral, 0, 0, dt);
    const oily = dampLateralVelocity(lateral, 0, 0, dt, 2.2);
    expect(oily).toBeGreaterThan(asphalt);
    expect(oily).toBeCloseTo(lateral * Math.exp(-2.2 * dt), 5);
  });

  it('does not raise grip above handbrake when surfaceGrip is high', () => {
    const handbrake = dampLateralVelocity(lateral, 1, 0, dt);
    const withSurface = dampLateralVelocity(lateral, 1, 0, dt, VEHICLE_LATERAL_GRIP);
    expect(withSurface).toBeCloseTo(handbrake, 5);
  });
});

describe('ground slope following', () => {
  it('keeps vertical velocity zero on flat ground', () => {
    expect(computeGroundFollowVy(0, 1, 0, 20, -5)).toBe(0);
  });

  it('produces the upward velocity needed to climb an inclined surface', () => {
    const theta = (10 * Math.PI) / 180;
    const vy = computeGroundFollowVy(0, Math.cos(theta), -Math.sin(theta), 0, 10);
    expect(vy).toBeGreaterThan(0);
    expect(vy).toBeCloseTo(10 * Math.tan(theta), 5);
  });

  it('ignores near-vertical (wall) contact normals', () => {
    expect(computeGroundFollowVy(1, 0.1, 0, 10, 0)).toBe(0);
  });

  it('clamps the climb rate so a steep normal cannot launch the car', () => {
    const theta = (19 * Math.PI) / 180; // под порогом 20° — еще «земля», но крутая
    const vy = computeGroundFollowVy(0, Math.cos(theta), -Math.sin(theta), 0, 25);
    // 25 * tan(19°) ≈ 8.6 > MAX_CLIMB_VY → зажато
    expect(vy).toBeLessThanOrEqual(MAX_CLIMB_VY);
    expect(vy).toBeGreaterThan(MAX_CLIMB_VY - 1.5);
  });

  it('derives the visual pitch from the ground normal, not from speed', () => {
    // подъем вперед (+Z): нормаль отклонена к -Z → нос вверх (отрицательный угол)
    const up = computeSlopePitchFromNormal(0, Math.cos(0.1), -Math.sin(0.1), 0, 1);
    expect(up).toBeLessThan(0);
    expect(up).toBeCloseTo(-0.1, 3);
    // спуск вперед → положительный
    const down = computeSlopePitchFromNormal(0, Math.cos(0.1), Math.sin(0.1), 0, 1);
    expect(down).toBeGreaterThan(0);
    // равнина → 0 независимо от скорости
    expect(computeSlopePitchFromNormal(0, 1, 0, 0, 1)).toBe(0);
  });

  it('keeps the slope pitch independent of heading (no turn spike)', () => {
    // тот же продольный склон, но курс вбок — уклон не вдоль forward → 0
    const sideways = computeSlopePitchFromNormal(0, Math.cos(0.1), -Math.sin(0.1), 1, 0);
    expect(sideways).toBeCloseTo(0, 6);
  });

  it('treats a wall normal as flat and caps the tilt at the max grade', () => {
    // ny = 0.5 < cos(20°) → это стена, а не дорога → без наклона
    expect(computeSlopePitchFromNormal(0, 0.5, -Math.sqrt(0.75), 0, 1)).toBe(0);
    // самый крутой разрешенный уклон = ровно SLOPE_MAX_GRADE
    const border = computeSlopePitchFromNormal(
      0,
      Math.cos(SLOPE_MAX_GRADE),
      -Math.sin(SLOPE_MAX_GRADE),
      0,
      1,
    );
    expect(border).toBeCloseTo(-SLOPE_MAX_GRADE, 4);
  });

  it('smooths toward the target monotonically without overshoot', () => {
    const dt = 1 / 60;
    const target = 0.2;
    let angle = 0;
    for (let i = 0; i < 120; i += 1) {
      const next = smoothAngleToward(angle, target, dt);
      expect(next).toBeLessThanOrEqual(target + 1e-9); // не перелетает цель
      expect(next).toBeGreaterThanOrEqual(angle - 1e-9); // монотонно снизу
      angle = next;
    }
    expect(angle).toBeCloseTo(target, 2);
  });

  it('rate-limits the per-frame visual angle step', () => {
    const dt = 1 / 60;
    const step = smoothAngleToward(0, 1, dt); // большой разрыв → потолок MAX_RATE*dt
    expect(step).toBeCloseTo(ANGLE_SMOOTH_MAX_RATE * dt, 6);
  });
});

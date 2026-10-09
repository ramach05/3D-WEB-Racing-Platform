import { describe, expect, it } from 'vitest';
import {
  computeRescueImpulse,
  isRescueActive,
  isStuckAgainstObstacle,
  RESCUE_BASE_ACCEL,
  RESCUE_CAR_ACCEL_SCALE,
  RESCUE_UP_SHARE,
  STUCK_AFTER_SECONDS,
  updateStuckTimer,
} from './anti-stuck';

const STUCK_PROBE = {
  throttle: 1,
  handbrake: 0,
  targetForward: 20,
  forwardSpeed: 0.2,
  grounded: true,
};

describe('isStuckAgainstObstacle', () => {
  it('detects full throttle into a wall at zero speed', () => {
    expect(isStuckAgainstObstacle(STUCK_PROBE)).toBe(true);
  });

  it('is false while the car accelerates normally', () => {
    expect(isStuckAgainstObstacle({ ...STUCK_PROBE, forwardSpeed: 18 })).toBe(false);
  });

  it('is false without throttle', () => {
    expect(isStuckAgainstObstacle({ ...STUCK_PROBE, throttle: 0.4 })).toBe(false);
  });

  it('is false on handbrake', () => {
    expect(isStuckAgainstObstacle({ ...STUCK_PROBE, handbrake: 1 })).toBe(false);
  });

  it('is false in the air', () => {
    expect(isStuckAgainstObstacle({ ...STUCK_PROBE, grounded: false })).toBe(false);
  });

  it('is false at crawl target speed', () => {
    expect(isStuckAgainstObstacle({ ...STUCK_PROBE, targetForward: 1.5 })).toBe(false);
  });
});

describe('updateStuckTimer', () => {
  it('accumulates while stuck and resets on recovery', () => {
    let timer = 0;
    timer = updateStuckTimer(true, 1 / 60, timer);
    timer = updateStuckTimer(true, 1 / 60, timer);
    expect(timer).toBeCloseTo(2 / 60);
    expect(updateStuckTimer(false, 1 / 60, timer)).toBe(0);
  });
});

describe('isRescueActive', () => {
  it('activates only past the threshold', () => {
    expect(isRescueActive(STUCK_AFTER_SECONDS * 0.99)).toBe(false);
    expect(isRescueActive(STUCK_AFTER_SECONDS)).toBe(true);
  });
});

describe('computeRescueImpulse', () => {
  const CAR = { x: 0, z: 0 };
  const FORWARD = { x: 0, z: 1 };

  it('pushes a front obstacle away and to the right on a dead-center hit', () => {
    const impulse = computeRescueImpulse({
      carPosition: CAR,
      carForward: FORWARD,
      obstaclePosition: { x: 0.01, z: 2 },
      obstacleMass: 4,
      carSpeed: 0,
      dt: 1 / 60,
    });
    expect(impulse).not.toBeNull();
    expect(impulse!.z).toBeGreaterThan(0);
    // мертвый центр -> сторона по умолчанию правая (+X при курсе +Z)
    expect(impulse!.x).toBeGreaterThan(0);
  });

  it('escapes a left-side obstacle further left', () => {
    const impulse = computeRescueImpulse({
      carPosition: CAR,
      carForward: FORWARD,
      obstaclePosition: { x: -1.2, z: 1.5 },
      obstacleMass: 4,
      carSpeed: 0,
      dt: 1 / 60,
    });
    expect(impulse).not.toBeNull();
    expect(impulse!.x).toBeLessThan(0);
    expect(impulse!.z).toBeGreaterThan(0);
  });

  it('ignores obstacles beside or behind the car axis', () => {
    const behind = computeRescueImpulse({
      carPosition: CAR,
      carForward: FORWARD,
      obstaclePosition: { x: 0, z: -1 },
      obstacleMass: 4,
      carSpeed: 0,
      dt: 1 / 60,
    });
    expect(behind).toBeNull();
  });

  it('is null on a degenerate distance', () => {
    const same = computeRescueImpulse({
      carPosition: CAR,
      carForward: FORWARD,
      obstaclePosition: { x: 0.01, z: 0.01 },
      obstacleMass: 4,
      carSpeed: 0,
      dt: 1 / 60,
    });
    expect(same).toBeNull();
  });

  it('scales with mass, dt and car speed; y is the fixed share', () => {
    const slow = computeRescueImpulse({
      carPosition: CAR,
      carForward: FORWARD,
      obstaclePosition: { x: 0, z: 2 },
      obstacleMass: 4,
      carSpeed: 0,
      dt: 1 / 60,
    });
    const fast = computeRescueImpulse({
      carPosition: CAR,
      carForward: FORWARD,
      obstaclePosition: { x: 0, z: 2 },
      obstacleMass: 4,
      carSpeed: 10,
      dt: 1 / 60,
    });
    const heavy = computeRescueImpulse({
      carPosition: CAR,
      carForward: FORWARD,
      obstaclePosition: { x: 0, z: 2 },
      obstacleMass: 8,
      carSpeed: 0,
      dt: 1 / 60,
    });

    const slowMag = Math.hypot(slow!.x, slow!.z);
    const fastMag = Math.hypot(fast!.x, fast!.z);
    const heavyMag = Math.hypot(heavy!.x, heavy!.z);

    expect(fastMag / slowMag).toBeCloseTo(
      (RESCUE_BASE_ACCEL + RESCUE_CAR_ACCEL_SCALE * 10) / RESCUE_BASE_ACCEL,
    );
    expect(heavyMag / slowMag).toBeCloseTo(2);
    expect(slow!.y).toBeCloseTo(slowMag * RESCUE_UP_SHARE);
  });
});

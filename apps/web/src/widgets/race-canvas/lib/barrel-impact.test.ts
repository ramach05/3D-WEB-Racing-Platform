import { describe, expect, it } from 'vitest';
import {
  BARREL_HIT_LEVER,
  BARREL_MASS,
  clampBarrelVelocity,
  computeBarrelBounce,
  computeBarrelDeltaV,
  computeBarrelSideDirection,
  computeBarrelSpeedCap,
} from './barrel-impact';

const CAR_AT = { x: 0, y: 0.95, z: -6 };

describe('computeBarrelSideDirection', () => {
  it('points away from the car axis toward the barrel', () => {
    const right = computeBarrelSideDirection(
      { x: 0, z: 10 },
      10,
      CAR_AT,
      { x: 0.3, y: 0.9, z: 4 },
      1,
    );
    const left = computeBarrelSideDirection(
      { x: 0, z: 10 },
      10,
      CAR_AT,
      { x: -0.3, y: 0.9, z: 4 },
      1,
    );

    // heading +Z, barrel right of the axis -> bounce toward +X
    expect(right.x).toBeCloseTo(1);
    expect(right.z).toBeCloseTo(0);
    // barrel left of the axis -> bounce toward -X
    expect(left.x).toBeCloseTo(-1);
    expect(left.z).toBeCloseTo(0);
  });

  it('flips the perpendicular for a sideways hit', () => {
    const side = computeBarrelSideDirection(
      { x: 12, z: 0 },
      12,
      CAR_AT,
      { x: 0, y: 0.9, z: -4 },
      1,
    );

    // heading +X, barrel on the +Z side -> bounce toward +Z
    expect(side.x).toBeCloseTo(0);
    expect(side.z).toBeCloseTo(1);
  });

  it('falls back to sideBias on a dead-center hit', () => {
    const barrel = { x: 0, y: 0.9, z: -3 };

    const right = computeBarrelSideDirection({ x: 0, z: 10 }, 10, CAR_AT, barrel, 1);
    const left = computeBarrelSideDirection({ x: 0, z: 10 }, 10, CAR_AT, barrel, -1);

    expect(right.x).toBeCloseTo(1);
    expect(right.z).toBeCloseTo(0);
    expect(left.x).toBeCloseTo(-1);
    expect(left.z).toBeCloseTo(0);
  });

  it('stays defined for a stalled car', () => {
    const side = computeBarrelSideDirection({ x: 0, z: 0 }, 0, CAR_AT, { x: 0, y: 0.9, z: 4 }, -1);

    expect(side.x).toBeCloseTo(-1);
    expect(side.z).toBeCloseTo(0);
  });
});

describe('computeBarrelDeltaV', () => {
  it('gives the lateral component most of the bounce', () => {
    const { forward, side, up } = computeBarrelDeltaV(20);

    expect(side).toBeGreaterThan(forward);
    expect(side).toBeGreaterThan(up);
  });

  it('kicks the barrel even at a crawl', () => {
    const { side, up } = computeBarrelDeltaV(0.5);

    expect(side).toBeGreaterThan(1);
    expect(up).toBeGreaterThan(0.5);
  });

  it('grows with the car speed', () => {
    expect(computeBarrelDeltaV(20).side).toBeGreaterThan(computeBarrelDeltaV(10).side);
    expect(computeBarrelDeltaV(10).side).toBeGreaterThan(computeBarrelDeltaV(5).side);
  });
});

describe('computeBarrelSpeedCap', () => {
  it('never clamps below the car speed', () => {
    // a cap below the car speed would stick the barrel to the bumper again
    for (const speed of [0, 5, 10, 20, 30]) {
      expect(computeBarrelSpeedCap(speed)).toBeGreaterThan(speed);
    }
  });
});

describe('clampBarrelVelocity', () => {
  it('leaves a barrel under the cap untouched', () => {
    const linvel = { x: 3, y: 1, z: 4 };
    const angvel = { x: 1, y: 0, z: -2 };

    expect(clampBarrelVelocity(linvel, angvel, 13.5)).toEqual({ linvel, angvel });
  });

  it('trims the speed but keeps the direction', () => {
    const { linvel } = clampBarrelVelocity({ x: 0, y: 0, z: 40 }, { x: 0, y: 0, z: 0 }, 10);

    expect(Math.hypot(linvel.x, linvel.z)).toBeCloseTo(10);
    expect(linvel.z).toBeGreaterThan(0);
  });

  it('caps upward speed only, letting the barrel fall', () => {
    const up = clampBarrelVelocity({ x: 0, y: 30, z: 0 }, { x: 0, y: 0, z: 0 }, 999);
    const down = clampBarrelVelocity({ x: 0, y: -30, z: 0 }, { x: 0, y: 0, z: 0 }, 999);

    expect(up.linvel.y).toBeLessThanOrEqual(6);
    expect(down.linvel.y).toBeCloseTo(-30);
  });

  it('caps the spin along the same axis', () => {
    const { angvel } = clampBarrelVelocity({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -60 }, 999);

    expect(Math.hypot(angvel.x, angvel.y, angvel.z)).toBeCloseTo(20);
    expect(angvel.z).toBeLessThan(0);
  });
});

describe('computeBarrelBounce', () => {
  const strike = {
    carPosition: CAR_AT,
    carVelocity: { x: 0, z: 10 },
    carSpeed: 10,
    barrelPosition: { x: 0.45, y: 0.9, z: 4 },
    sideBias: 1 as const,
  };

  it('pushes the barrel sideways off the car axis', () => {
    const { impulse } = computeBarrelBounce(strike);

    // lateral component clearly larger than longitudinal
    expect(impulse.x).toBeGreaterThan(impulse.z);
    expect(impulse.z).toBeGreaterThan(0);
  });

  it('converts the delta-v into an impulse with the barrel mass', () => {
    const { forward, side, up } = computeBarrelDeltaV(strike.carSpeed);

    const { impulse } = computeBarrelBounce(strike);

    expect(impulse.x).toBeCloseTo(BARREL_MASS * side);
    expect(impulse.z).toBeCloseTo(BARREL_MASS * forward);
    expect(impulse.y).toBeCloseTo(BARREL_MASS * up);
    expect(Math.hypot(impulse.x, impulse.z)).toBeCloseTo(BARREL_MASS * Math.hypot(side, forward));
  });

  it('hits above the center so the barrel tumbles', () => {
    const { point } = computeBarrelBounce(strike);

    expect(point.y).toBeCloseTo(strike.barrelPosition.y + BARREL_HIT_LEVER);
    expect(point.x).toBeCloseTo(strike.barrelPosition.x);
  });

  it('spins the barrel into a forward roll, not a drift', () => {
    const { torqueImpulse, impulse } = computeBarrelBounce(strike);

    // the rolling axis is horizontal and perpendicular to the launch direction
    expect(torqueImpulse.y).toBe(0);
    expect(torqueImpulse.x * impulse.x + torqueImpulse.z * impulse.z).toBeCloseTo(0);
    // barrel flies toward +X -> rolling requires negative rotation around Z
    expect(torqueImpulse.z).toBeLessThan(0);
  });

  it('sends a dead-center hit to the biased side', () => {
    const centered = computeBarrelBounce({
      ...strike,
      barrelPosition: { x: 0, y: 0.9, z: -3 },
      sideBias: -1,
    });

    expect(centered.impulse.x).toBeLessThan(0);
  });

  it('carries a safety cap above the car speed', () => {
    const { speedCap } = computeBarrelBounce(strike);

    expect(speedCap).toBeCloseTo(computeBarrelSpeedCap(strike.carSpeed));
    expect(speedCap).toBeGreaterThan(strike.carSpeed);
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { registerTireHit, resetTireHitDamping, tickTireHitDamping } from './tire-hit-damping';

describe('tireHitDamping', () => {
  afterEach(() => {
    resetTireHitDamping();
  });

  it('starts at full speed after reset', () => {
    resetTireHitDamping();

    const factor = tickTireHitDamping(0);

    expect(factor).toBe(1);
  });

  it('keeps the stronger hit penalty', () => {
    registerTireHit(0.8);
    registerTireHit(0.4);

    const factor = tickTireHitDamping(0);

    expect(factor).toBe(0.4);
  });

  it('clamps negative hit factors to zero', () => {
    registerTireHit(-1);

    const factor = tickTireHitDamping(0);

    expect(factor).toBe(0);
  });

  it('recovers toward one over time', () => {
    registerTireHit(0.5);

    const during = tickTireHitDamping(0.2);
    const after = tickTireHitDamping(0);

    expect(during).toBe(0.5);
    expect(after).toBeCloseTo(0.8, 5);
  });

  it('does not exceed one after full recovery', () => {
    registerTireHit(0.9);

    tickTireHitDamping(2);
    const factor = tickTireHitDamping(0);

    expect(factor).toBe(1);
  });
});

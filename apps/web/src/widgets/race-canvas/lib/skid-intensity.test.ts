import { describe, expect, it } from 'vitest';
import {
  computeSkidIntensity,
  LAUNCH_SPEED_END,
  LAUNCH_SPEED_PEAK,
  SKID_SMOKE_THRESHOLD,
  SKID_SPEED_FULL,
  SKID_SPEED_MIN,
} from './skid-intensity';

describe('computeSkidIntensity', () => {
  it('returns zero without brake or throttle', () => {
    const result = computeSkidIntensity({
      brake: 0,
      throttle: 0,
      forwardSpeed: 30,
      lateral: 0,
      grounded: true,
    });

    expect(result).toEqual({ intensity: 0, smoking: false, wheels: 'all' });
  });

  it('returns zero when not grounded', () => {
    const result = computeSkidIntensity({
      brake: 1,
      throttle: 0,
      forwardSpeed: 30,
      lateral: 5,
      grounded: false,
    });

    expect(result).toEqual({ intensity: 0, smoking: false, wheels: 'all' });
  });

  it('returns zero braking below speed threshold', () => {
    const result = computeSkidIntensity({
      brake: 1,
      throttle: 0,
      forwardSpeed: SKID_SPEED_MIN - 0.01,
      lateral: 0,
      grounded: true,
    });

    expect(result).toEqual({ intensity: 0, smoking: false, wheels: 'all' });
  });

  it('ramps intensity with forward speed while braking', () => {
    const low = computeSkidIntensity({
      brake: 1,
      throttle: 0,
      forwardSpeed: SKID_SPEED_MIN,
      lateral: 0,
      grounded: true,
    });
    const mid = computeSkidIntensity({
      brake: 1,
      throttle: 0,
      forwardSpeed: (SKID_SPEED_MIN + SKID_SPEED_FULL) / 2,
      lateral: 0,
      grounded: true,
    });
    const full = computeSkidIntensity({
      brake: 1,
      throttle: 0,
      forwardSpeed: SKID_SPEED_FULL,
      lateral: 0,
      grounded: true,
    });

    expect(low.intensity).toBe(0);
    expect(mid.intensity).toBeGreaterThan(low.intensity);
    expect(full.intensity).toBeCloseTo(0.75, 5);
    expect(full.smoking).toBe(true);
    expect(full.wheels).toBe('all');
  });

  it('uses absolute reverse speed the same as forward when braking', () => {
    const forward = computeSkidIntensity({
      brake: 1,
      throttle: 0,
      forwardSpeed: 25,
      lateral: 0,
      grounded: true,
    });
    const reverse = computeSkidIntensity({
      brake: 1,
      throttle: 0,
      forwardSpeed: -25,
      lateral: 0,
      grounded: true,
    });

    expect(reverse.intensity).toBeCloseTo(forward.intensity, 5);
  });

  it('boosts intensity with lateral slip under braking', () => {
    const straight = computeSkidIntensity({
      brake: 1,
      throttle: 0,
      forwardSpeed: 20,
      lateral: 0,
      grounded: true,
    });
    const sliding = computeSkidIntensity({
      brake: 1,
      throttle: 0,
      forwardSpeed: 20,
      lateral: 8,
      grounded: true,
    });

    expect(sliding.intensity).toBeGreaterThan(straight.intensity);
    expect(sliding.intensity).toBeLessThanOrEqual(1);
  });

  it('marks smoking only above the smoke threshold when braking', () => {
    const mild = computeSkidIntensity({
      brake: 1,
      throttle: 0,
      forwardSpeed: 16,
      lateral: 0,
      grounded: true,
    });
    const hard = computeSkidIntensity({
      brake: 1,
      throttle: 0,
      forwardSpeed: SKID_SPEED_FULL,
      lateral: 8,
      grounded: true,
    });

    expect(mild.smoking).toBe(mild.intensity > SKID_SMOKE_THRESHOLD);
    expect(hard.smoking).toBe(true);
    expect(hard.intensity).toBe(1);
  });

  it('leaves strong rear-wheel marks on hard launch from standstill', () => {
    const result = computeSkidIntensity({
      brake: 0,
      throttle: 1,
      forwardSpeed: 0.5,
      lateral: 0,
      grounded: true,
    });

    expect(result.intensity).toBeGreaterThan(0.7);
    expect(result.smoking).toBe(true);
    expect(result.wheels).toBe('rear');
  });

  it('keeps launch marks through the peak window then fades', () => {
    const peak = computeSkidIntensity({
      brake: 0,
      throttle: 1,
      forwardSpeed: LAUNCH_SPEED_PEAK,
      lateral: 0,
      grounded: true,
    });
    const mid = computeSkidIntensity({
      brake: 0,
      throttle: 1,
      forwardSpeed: (LAUNCH_SPEED_PEAK + LAUNCH_SPEED_END) / 2,
      lateral: 0,
      grounded: true,
    });
    const done = computeSkidIntensity({
      brake: 0,
      throttle: 1,
      forwardSpeed: LAUNCH_SPEED_END,
      lateral: 0,
      grounded: true,
    });

    expect(peak.intensity).toBeGreaterThan(mid.intensity);
    expect(mid.intensity).toBeGreaterThan(0);
    expect(done.intensity).toBe(0);
    expect(peak.wheels).toBe('rear');
  });

  it('does not leave launch marks at high speed', () => {
    const result = computeSkidIntensity({
      brake: 0,
      throttle: 1,
      forwardSpeed: 25,
      lateral: 0,
      grounded: true,
    });

    expect(result).toEqual({ intensity: 0, smoking: false, wheels: 'all' });
  });

  it('prefers brake marks over launch when both inputs are held', () => {
    const result = computeSkidIntensity({
      brake: 1,
      throttle: 1,
      forwardSpeed: 25,
      lateral: 0,
      grounded: true,
    });

    expect(result.wheels).toBe('all');
    expect(result.intensity).toBeGreaterThan(0);
  });
});

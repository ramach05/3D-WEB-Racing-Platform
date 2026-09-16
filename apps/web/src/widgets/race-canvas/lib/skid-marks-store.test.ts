import { afterEach, describe, expect, it } from 'vitest';
import {
  getSkidMarksSnapshot,
  pushSkidSample,
  pushSkidSmoke,
  resetSkidMarks,
  SKID_MIN_STEP,
  SKID_SMOKE_LIFE,
  skidSegmentOpacity,
  skidSmokeOpacity,
  skidSmokeProgress,
  tickSkidMarks,
} from './skid-marks-store';

describe('skidMarksStore', () => {
  afterEach(() => {
    resetSkidMarks();
  });

  it('rejects samples below min step', () => {
    const ok = pushSkidSample(0, 0, SKID_MIN_STEP * 0.5, 0, 1);
    expect(ok).toBe(false);
    expect(getSkidMarksSnapshot().segments.some((s) => s.alive)).toBe(false);
  });

  it('stores a segment with center and yaw', () => {
    const ok = pushSkidSample(0, 0, 0, 1, 0.8);
    expect(ok).toBe(true);

    const segment = getSkidMarksSnapshot().segments.find((s) => s.alive);
    expect(segment).toBeDefined();
    expect(segment!.x).toBeCloseTo(0, 5);
    expect(segment!.z).toBeCloseTo(0.5, 5);
    expect(segment!.yaw).toBeCloseTo(0, 5);
    expect(segment!.length).toBeCloseTo(1, 5);
    expect(segment!.opacity).toBeGreaterThan(0.4);
  });

  it('keeps segment opacity after long tick until reset', () => {
    pushSkidSample(0, 0, 0, 1, 1);
    const segment = getSkidMarksSnapshot().segments.find((s) => s.alive)!;
    const initial = skidSegmentOpacity(segment);

    tickSkidMarks(120);
    expect(segment.alive).toBe(true);
    expect(skidSegmentOpacity(segment)).toBe(initial);
  });

  it('spawns smoke with wake velocity and expires by individual life', () => {
    pushSkidSmoke(1, 0.12, 2, 0.9, 4, 0, -2);
    const particle = getSkidMarksSnapshot().smoke.find((s) => s.alive)!;
    expect(particle).toBeDefined();
    expect(skidSmokeProgress(particle)).toBe(0);
    expect(particle.vx).not.toBe(0);
    expect(particle.vy).toBeGreaterThan(0);
    expect(particle.vz).not.toBe(0);
    expect(particle.life).toBeGreaterThan(SKID_SMOKE_LIFE * 0.8);
    expect(particle.life).toBeLessThan(SKID_SMOKE_LIFE * 1.4);

    const startX = particle.x;
    const startY = particle.y;
    tickSkidMarks(0.1);
    expect(particle.x).not.toBeCloseTo(startX, 5);
    expect(particle.y).toBeGreaterThan(startY);
    expect(skidSmokeProgress(particle)).toBeGreaterThan(0);
    expect(particle.alive).toBe(true);

    tickSkidMarks(particle.life);
    expect(particle.alive).toBe(false);
  });

  it('skidSmokeOpacity peaks early then falls to zero', () => {
    expect(skidSmokeOpacity(0)).toBe(0);
    expect(skidSmokeOpacity(1)).toBe(0);
    const peak = skidSmokeOpacity(0.22);
    const late = skidSmokeOpacity(0.8);
    expect(peak).toBeGreaterThan(late);
    expect(peak).toBeGreaterThan(0.2);
  });

  it('reset clears segments and smoke', () => {
    pushSkidSample(0, 0, 0, 1, 1);
    pushSkidSmoke(0, 0.1, 0, 1, 1, 0, 0);
    resetSkidMarks();

    const snap = getSkidMarksSnapshot();
    expect(snap.segments.every((s) => !s.alive)).toBe(true);
    expect(snap.smoke.every((s) => !s.alive)).toBe(true);
  });
});

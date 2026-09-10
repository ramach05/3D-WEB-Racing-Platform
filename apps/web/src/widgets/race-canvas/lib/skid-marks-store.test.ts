import { afterEach, describe, expect, it } from 'vitest';
import {
  getSkidMarksSnapshot,
  pushSkidSample,
  pushSkidSmoke,
  resetSkidMarks,
  SKID_FADE_SECONDS,
  SKID_MIN_STEP,
  SKID_SMOKE_LIFE,
  skidSegmentOpacity,
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

  it('fades opacity over lifetime and clears after fade', () => {
    pushSkidSample(0, 0, 0, 1, 1);
    const segment = getSkidMarksSnapshot().segments.find((s) => s.alive)!;
    const initial = skidSegmentOpacity(segment);

    tickSkidMarks(SKID_FADE_SECONDS * 0.5);
    const mid = skidSegmentOpacity(segment);
    expect(mid).toBeLessThan(initial);
    expect(mid).toBeGreaterThan(0);

    tickSkidMarks(SKID_FADE_SECONDS);
    expect(segment.alive).toBe(false);
    expect(skidSegmentOpacity(segment)).toBe(0);
  });

  it('spawns and expires smoke particles', () => {
    pushSkidSmoke(1, 0.12, 2, 0.9);
    const particle = getSkidMarksSnapshot().smoke.find((s) => s.alive)!;
    expect(particle).toBeDefined();
    expect(skidSmokeProgress(particle)).toBe(0);

    tickSkidMarks(SKID_SMOKE_LIFE * 0.5);
    expect(skidSmokeProgress(particle)).toBeCloseTo(0.5, 5);
    expect(particle.alive).toBe(true);

    tickSkidMarks(SKID_SMOKE_LIFE);
    expect(particle.alive).toBe(false);
  });

  it('reset clears segments and smoke', () => {
    pushSkidSample(0, 0, 0, 1, 1);
    pushSkidSmoke(0, 0.1, 0, 1);
    resetSkidMarks();

    const snap = getSkidMarksSnapshot();
    expect(snap.segments.every((s) => !s.alive)).toBe(true);
    expect(snap.smoke.every((s) => !s.alive)).toBe(true);
  });
});

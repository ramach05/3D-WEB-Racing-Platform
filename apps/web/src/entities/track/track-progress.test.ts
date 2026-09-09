import { describe, expect, it } from 'vitest';
import { accumulateLapTravel, advanceLapProgress, getTrackProgress } from './track-progress';
import { coastalOvalTrack } from './config';

describe('getTrackProgress', () => {
  it('maps centerline points to ratio', () => {
    const midIndex = Math.floor(coastalOvalTrack.centerline.length / 2);
    const mid = coastalOvalTrack.centerline[midIndex]!;
    const progress = getTrackProgress(mid.x, mid.z, coastalOvalTrack.centerline);
    expect(progress.ratio).toBeGreaterThan(0.4);
    expect(progress.ratio).toBeLessThan(0.6);
  });
});

describe('advanceLapProgress', () => {
  it('increases while driving forward', () => {
    expect(advanceLapProgress(0.1, 0.3)).toBe(0.3);
  });

  it('ignores wrap-around drop near finish', () => {
    expect(advanceLapProgress(0.88, 0.04)).toBe(0.88);
  });
});

describe('accumulateLapTravel', () => {
  it('accumulates race-direction deltas (decreasing ratio)', () => {
    let travel = 0;
    let last: number | null = null;
    for (const ratio of [0.35, 0.2, 0.1]) {
      const next = accumulateLapTravel(travel, last, ratio);
      travel = next.lapTravel;
      last = next.lastRatio;
    }
    expect(travel).toBeCloseTo(0.25, 5);
  });

  it('ignores large nearest-point jumps but keeps accumulating afterward', () => {
    let travel = 0;
    let last: number | null = 0.85;

    let next = accumulateLapTravel(travel, last, 0.3);
    travel = next.lapTravel;
    last = next.lastRatio;
    expect(travel).toBe(0);

    for (const ratio of [0.25, 0.2, 0.15, 0.1]) {
      next = accumulateLapTravel(travel, last, ratio);
      travel = next.lapTravel;
      last = next.lastRatio;
    }
    expect(travel).toBeGreaterThan(0.1);
    expect(travel).toBeCloseTo(0.2, 2);
  });

  it('handles wrap near start without resetting travel', () => {
    const travel = 0.9;
    const last: number | null = 0.02;
    const next = accumulateLapTravel(travel, last, 0.95);
    expect(next.lapTravel).toBeCloseTo(0.97, 5);
  });

  it('ignores reverse (increasing ratio) travel', () => {
    const travel = 0;
    const last: number | null = 0.1;
    const next = accumulateLapTravel(travel, last, 0.3);
    expect(next.lapTravel).toBe(0);
  });
});

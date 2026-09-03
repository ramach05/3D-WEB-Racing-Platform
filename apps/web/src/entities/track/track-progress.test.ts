import { describe, expect, it } from 'vitest';
import { advanceLapProgress, getTrackProgress } from './track-progress';
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

import { describe, expect, it } from 'vitest';
import type { TUserStats, TUserTrackStat } from '@racing/shared';
import { getAchievements } from './achievements';

const trackStat = (overrides: Partial<TUserTrackStat> = {}): TUserTrackStat => ({
  trackId: 't1',
  trackSlug: 'coastal-oval',
  trackName: 'Coastal Oval',
  races: 1,
  bestTimeMs: 50_000,
  totalTimeMs: 120_000,
  rank: 5,
  gapToLeaderMs: 5_000,
  improvementMs: 0,
  ...overrides,
});

const statsOf = (overrides: Partial<TUserStats> = {}): TUserStats => ({
  totalRaces: 0,
  tracksCompleted: 0,
  totalTimeMs: 0,
  firstRaceAt: null,
  lastRaceAt: null,
  perTrack: [],
  ...overrides,
});

describe('getAchievements', () => {
  it('keeps everything locked for an empty profile', () => {
    const achievements = getAchievements(statsOf());

    expect(achievements).toHaveLength(6);
    expect(achievements.every((row) => !row.unlocked)).toBe(true);
  });

  it('unlocks first-finish and counts marathon progress', () => {
    const achievements = getAchievements(statsOf({ totalRaces: 3 }));

    expect(achievements.find((row) => row.id === 'first-finish')?.unlocked).toBe(true);
    const marathon = achievements.find((row) => row.id === 'marathon');
    expect(marathon?.unlocked).toBe(false);
    expect(marathon?.progress).toBe(3);
  });

  it('unlocks marathon at 25 races and clamps progress', () => {
    const achievements = getAchievements(statsOf({ totalRaces: 40 }));

    const marathon = achievements.find((row) => row.id === 'marathon');
    expect(marathon?.unlocked).toBe(true);
    expect(marathon?.progress).toBe(25);
  });

  it('unlocks sub-forty-five only with a best under 45s', () => {
    const slow = getAchievements(statsOf({ perTrack: [trackStat({ bestTimeMs: 45_000 })] }));
    const fast = getAchievements(statsOf({ perTrack: [trackStat({ bestTimeMs: 44_999 })] }));

    expect(slow.find((row) => row.id === 'sub-forty-five')?.unlocked).toBe(false);
    expect(fast.find((row) => row.id === 'sub-forty-five')?.unlocked).toBe(true);
  });

  it('unlocks improver from the biggest track improvement', () => {
    const achievements = getAchievements(
      statsOf({
        perTrack: [trackStat({ improvementMs: 1_999 }), trackStat({ improvementMs: 2_000 })],
      }),
    );

    const improver = achievements.find((row) => row.id === 'improver');
    expect(improver?.unlocked).toBe(true);
    expect(improver?.progress).toBe(2_000);
  });

  it('unlocks all-tracks and podium by track coverage and rank', () => {
    const achievements = getAchievements(
      statsOf({
        tracksCompleted: 3,
        perTrack: [trackStat({ rank: 3 }), trackStat({ rank: 4 })],
      }),
    );

    expect(achievements.find((row) => row.id === 'all-tracks')?.unlocked).toBe(true);
    expect(achievements.find((row) => row.id === 'podium')?.unlocked).toBe(true);
  });
});

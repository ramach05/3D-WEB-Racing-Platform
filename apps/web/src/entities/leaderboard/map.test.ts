import { describe, expect, it } from 'vitest';
import type { LeaderboardEntry } from '@racing/shared';
import { formatRaceTime } from '@/shared/lib';

/** Сортирует результаты по времени и ставит rank */
const mapLeaderboard = (rows: Array<Omit<LeaderboardEntry, 'rank'>>): LeaderboardEntry[] => {
  return [...rows]
    .sort((a, b) => a.timeMs - b.timeMs)
    .map((row, index) => ({ ...row, rank: index + 1 }));
};

describe('mapLeaderboard', () => {
  it('orders racers by time and assigns ranks', () => {
    // Arrange
    const rows: Array<Omit<LeaderboardEntry, 'rank'>> = [
      { userId: 'b', nickname: 'B', timeMs: 40_000, createdAt: '2026-01-01T00:00:00.000Z' },
      { userId: 'a', nickname: 'A', timeMs: 33_000, createdAt: '2026-01-01T00:00:00.000Z' },
    ];

    // Act
    const mapped = mapLeaderboard(rows);

    // Assert
    expect(mapped[0]?.nickname).toBe('A');
    expect(mapped[0]?.rank).toBe(1);
    expect(mapped[1]?.rank).toBe(2);
    expect(formatRaceTime(mapped[0]?.timeMs ?? 0)).toBe('00:33.00');
  });
});

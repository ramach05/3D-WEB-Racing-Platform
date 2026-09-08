import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RaceResultsService } from './race-results.service';

describe('RaceResultsService', () => {
  it('throws when track is missing for leaderboard', async () => {
    const prisma = {
      track: { findUnique: vi.fn().mockResolvedValue(null) },
      raceResult: { findMany: vi.fn() },
    };
    const service = new RaceResultsService(prisma as never);

    await expect(service.leaderboard('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps best time per user and assigns ranks', async () => {
    const prisma = {
      track: { findUnique: vi.fn().mockResolvedValue({ id: 't1' }) },
      raceResult: {
        findMany: vi.fn().mockResolvedValue([
          {
            userId: 'u1',
            timeMs: 30_000,
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
            user: { nickname: 'fast' },
          },
          {
            userId: 'u1',
            timeMs: 40_000,
            createdAt: new Date('2024-01-02T00:00:00.000Z'),
            user: { nickname: 'fast' },
          },
          {
            userId: 'u2',
            timeMs: 35_000,
            createdAt: new Date('2024-01-03T00:00:00.000Z'),
            user: { nickname: 'second' },
          },
        ]),
      },
    };
    const service = new RaceResultsService(prisma as never);

    const board = await service.leaderboard('t1');

    expect(board).toEqual([
      {
        rank: 1,
        userId: 'u1',
        nickname: 'fast',
        timeMs: 30_000,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        rank: 2,
        userId: 'u2',
        nickname: 'second',
        timeMs: 35_000,
        createdAt: '2024-01-03T00:00:00.000Z',
      },
    ]);
  });
});

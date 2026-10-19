import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

/** Real bcrypt hash for tests that compare passwords (cost 4 — faster without losing meaning) */
const hashOf = async (password: string): Promise<string> => bcrypt.hash(password, 4);

type TPrismaMock = {
  user: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  raceResult: { groupBy: ReturnType<typeof vi.fn> };
  refreshSession: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
};

/** Builds AuthService with Prisma/Jwt/Config stubs for the tests below */
const makeService = (): {
  service: AuthService;
  prisma: TPrismaMock;
  sign: ReturnType<typeof vi.fn>;
} => {
  const prisma: TPrismaMock = {
    user: { findUnique: vi.fn(), create: vi.fn() },
    raceResult: { groupBy: vi.fn().mockResolvedValue([]) },
    refreshSession: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const sign = vi.fn(() => 'access-jwt');
  const jwtService = { sign } as never;
  const configService = { getOrThrow: vi.fn(() => 'test-secret-value') } as never;
  return { service: new AuthService(prisma as never, jwtService, configService), prisma, sign };
};

const freshUser = {
  id: 'u1',
  nickname: 'racer_01',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('AuthService.register', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('normalizes nickname, hashes password and issues tokens', async () => {
    ctx.prisma.user.findUnique.mockResolvedValue(null);
    ctx.prisma.user.create.mockResolvedValue(freshUser);
    ctx.prisma.refreshSession.create.mockResolvedValue({ id: 's1' });

    const result = await ctx.service.register({
      nickname: '  Racer_01 ',
      password: '1234',
    });

    expect(ctx.prisma.user.findUnique).toHaveBeenCalledWith({ where: { nickname: 'racer_01' } });
    const createArg = ctx.prisma.user.create.mock.calls[0]?.[0] as {
      data: { nickname: string; passwordHash: string };
    };
    expect(createArg.data.nickname).toBe('racer_01');
    expect(createArg.data.passwordHash).not.toBe('1234');

    const sessionArg = ctx.prisma.refreshSession.create.mock.calls[0]?.[0] as {
      data: { userId: string; tokenHash: string };
    };
    expect(sessionArg.data.userId).toBe('u1');
    expect(sessionArg.data.tokenHash).toMatch(/^[0-9a-f]{64}$/);

    expect(result.user).toEqual({
      id: 'u1',
      nickname: 'racer_01',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.accessToken).toBe('access-jwt');
    expect(result.refreshToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a taken nickname', async () => {
    ctx.prisma.user.findUnique.mockResolvedValue(freshUser);

    await expect(
      ctx.service.register({ nickname: 'racer_01', password: '1234' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ctx.prisma.user.create).not.toHaveBeenCalled();
  });
});

describe('AuthService.login', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('rejects an unknown nickname (still runs bcrypt against a dummy hash)', async () => {
    ctx.prisma.user.findUnique.mockResolvedValue(null);

    await expect(ctx.service.login({ nickname: 'ghost', password: '1234' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(ctx.prisma.refreshSession.create).not.toHaveBeenCalled();
  });

  it('rejects a wrong password', async () => {
    ctx.prisma.user.findUnique.mockResolvedValue({ ...freshUser, passwordHash: 'nope-not-a-hash' });

    await expect(
      ctx.service.login({ nickname: 'racer_01', password: '1234' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('issues tokens on valid credentials', async () => {
    ctx.prisma.user.findUnique.mockResolvedValue({
      ...freshUser,
      passwordHash: await hashOf('1234'),
    });
    ctx.prisma.refreshSession.create.mockResolvedValue({ id: 's1' });

    const result = await ctx.service.login({ nickname: 'RACER_01', password: '1234' });

    expect(result.accessToken).toBe('access-jwt');
    expect(ctx.sign).toHaveBeenCalled();
  });
});

describe('AuthService.refresh', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('rejects a missing token', async () => {
    await expect(ctx.service.refresh(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unknown token', async () => {
    ctx.prisma.refreshSession.findUnique.mockResolvedValue(null);
    await expect(ctx.service.refresh('deadbeef')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revokes all sessions when a rotated (reused) token is replayed', async () => {
    ctx.prisma.refreshSession.findUnique.mockResolvedValue({
      id: 'old',
      userId: 'u1',
      revokedAt: new Date(),
      replacedById: 'new',
      expiresAt: new Date(Date.now() + 1000),
    });

    await expect(ctx.service.refresh('replayed')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(ctx.prisma.refreshSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', revokedAt: null } }),
    );
  });

  it('revokes and rejects an expired session', async () => {
    ctx.prisma.refreshSession.findUnique.mockResolvedValue({
      id: 'old',
      userId: 'u1',
      revokedAt: null,
      replacedById: null,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(ctx.service.refresh('expired')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(ctx.prisma.refreshSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'old' } }),
    );
  });

  it('rotates a valid session and revokes the old one', async () => {
    ctx.prisma.refreshSession.findUnique.mockResolvedValue({
      id: 'old',
      userId: 'u1',
      revokedAt: null,
      replacedById: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    ctx.prisma.user.findUnique.mockResolvedValue(freshUser);
    ctx.prisma.refreshSession.create.mockResolvedValue({ id: 'new' });

    const result = await ctx.service.refresh('valid-token');

    expect(result.accessToken).toBe('access-jwt');
    expect(ctx.prisma.refreshSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'old' },
        data: expect.objectContaining({ replacedById: 'new' }),
      }),
    );
  });
});

describe('AuthService.logout', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('is a no-op for a missing or unknown token', async () => {
    ctx.prisma.refreshSession.findUnique.mockResolvedValue(null);
    await ctx.service.logout(undefined);
    await ctx.service.logout('unknown');
    expect(ctx.prisma.refreshSession.update).not.toHaveBeenCalled();
  });

  it('revokes an active session', async () => {
    ctx.prisma.refreshSession.findUnique.mockResolvedValue({
      id: 's1',
      revokedAt: null,
    });
    await ctx.service.logout('valid');
    expect(ctx.prisma.refreshSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' } }),
    );
  });
});

describe('AuthService.me', () => {
  it('keeps only the best result per track and throws for a missing user', async () => {
    const ctx = makeService();
    ctx.prisma.user.findUnique.mockResolvedValue({
      ...freshUser,
      raceResults: [
        {
          trackId: 't1',
          timeMs: 30_000,
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          track: { slug: 'coastal-oval', name: 'Coastal Oval' },
        },
        {
          trackId: 't1',
          timeMs: 40_000,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          track: { slug: 'coastal-oval', name: 'Coastal Oval' },
        },
      ],
    });
    ctx.prisma.raceResult.groupBy.mockResolvedValue([
      { userId: 'u1', trackId: 't1', _min: { timeMs: 30_000 } },
      { userId: 'u2', trackId: 't1', _min: { timeMs: 25_000 } },
    ]);

    const me = await ctx.service.me({ userId: 'u1', nickname: 'racer_01' });
    expect(me.bestResults).toHaveLength(1);
    expect(me.bestResults[0]?.timeMs).toBe(30_000);

    expect(me.stats).toEqual({
      totalRaces: 2,
      tracksCompleted: 1,
      totalTimeMs: 70_000,
      firstRaceAt: '2026-01-01T00:00:00.000Z',
      lastRaceAt: '2026-01-02T00:00:00.000Z',
      perTrack: [
        {
          trackId: 't1',
          trackSlug: 'coastal-oval',
          trackName: 'Coastal Oval',
          races: 2,
          bestTimeMs: 30_000,
          totalTimeMs: 70_000,
          rank: 2,
          gapToLeaderMs: 5_000,
          improvementMs: 10_000,
        },
      ],
    });

    ctx.prisma.user.findUnique.mockResolvedValue(null);
    await expect(ctx.service.me({ userId: 'x', nickname: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns zero stats without race results and skips the standings query', async () => {
    const ctx = makeService();
    ctx.prisma.user.findUnique.mockResolvedValue({ ...freshUser, raceResults: [] });

    const me = await ctx.service.me({ userId: 'u1', nickname: 'racer_01' });

    expect(ctx.prisma.raceResult.groupBy).not.toHaveBeenCalled();
    expect(me.stats).toEqual({
      totalRaces: 0,
      tracksCompleted: 0,
      totalTimeMs: 0,
      firstRaceAt: null,
      lastRaceAt: null,
      perTrack: [],
    });
  });
});

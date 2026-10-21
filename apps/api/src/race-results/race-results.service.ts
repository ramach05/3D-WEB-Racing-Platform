import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { TLeaderboardEntry, TRaceResultPublic } from '@racing/shared';
import type { TJwtUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateRaceResultDto } from './dto/create-race-result.dto';

const LEADERBOARD_LIMIT = 20;

/** Race results and leaderboard. Class is required by Nest DI. */
@Injectable()
export class RaceResultsService {
  constructor(private readonly prisma: PrismaService) {}

  create = async (user: TJwtUser, dto: CreateRaceResultDto): Promise<TRaceResultPublic> => {
    const track = await this.prisma.track.findUnique({ where: { id: dto.trackId } });
    if (!track) {
      throw new NotFoundException('Track not found');
    }
    if (!track.isAvailable) {
      throw new BadRequestException('Track is not available yet');
    }

    const created = await this.prisma.raceResult.create({
      data: {
        userId: user.userId,
        trackId: dto.trackId,
        timeMs: dto.timeMs,
      },
    });

    return {
      id: created.id,
      timeMs: created.timeMs,
      userId: created.userId,
      trackId: created.trackId,
      createdAt: created.createdAt.toISOString(),
    };
  };

  leaderboard = async (trackSlug: string): Promise<TLeaderboardEntry[]> => {
    const track = await this.prisma.track.findUnique({ where: { slug: trackSlug } });
    if (!track) {
      throw new NotFoundException('Track not found');
    }

    const results = await this.prisma.raceResult.findMany({
      where: { trackId: track.id },
      orderBy: { timeMs: 'asc' },
      include: { user: true },
    });

    const bestByUser = new Map<string, (typeof results)[number]>();
    for (const result of results) {
      if (!bestByUser.has(result.userId)) {
        bestByUser.set(result.userId, result);
      }
    }

    return [...bestByUser.values()].slice(0, LEADERBOARD_LIMIT).map((result, index) => ({
      rank: index + 1,
      userId: result.userId,
      nickname: result.user.nickname,
      timeMs: result.timeMs,
      createdAt: result.createdAt.toISOString(),
    }));
  };
}

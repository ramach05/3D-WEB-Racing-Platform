import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { TLeaderboardEntry, TRaceResultPublic } from '@racing/shared';
import type { TJwtUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateRaceResultDto } from './dto/create-race-result.dto';

const LEADERBOARD_LIMIT = 20;

/** Результаты и таблица лидеров. Класс нужен Nest DI. */
@Injectable()
export class RaceResultsService {
  constructor(private readonly prisma: PrismaService) {}

  create = async (user: TJwtUser, dto: CreateRaceResultDto): Promise<TRaceResultPublic> => {
    const track = await this.prisma.track.findUnique({ where: { id: dto.trackId } });
    if (!track) {
      throw new NotFoundException('Трасса не найдена');
    }
    if (!track.isAvailable) {
      throw new BadRequestException('Трасса пока недоступна');
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

  leaderboard = async (trackId: string): Promise<TLeaderboardEntry[]> => {
    const track = await this.prisma.track.findUnique({ where: { id: trackId } });
    if (!track) {
      throw new NotFoundException('Трасса не найдена');
    }

    const results = await this.prisma.raceResult.findMany({
      where: { trackId },
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

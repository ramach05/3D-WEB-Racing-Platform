import { Injectable } from '@nestjs/common';
import type { TTrackPublic } from '@racing/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Список трасс. Класс нужен Nest DI. */
@Injectable()
export class TracksService {
  constructor(private readonly prisma: PrismaService) {}

  list = async (): Promise<TTrackPublic[]> => {
    const tracks = await this.prisma.track.findMany({ orderBy: { name: 'asc' } });
    return tracks.map((track) => ({
      id: track.id,
      slug: track.slug,
      name: track.name,
      isAvailable: track.isAvailable,
    }));
  };
}

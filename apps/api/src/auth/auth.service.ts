import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { TAuthTokens, TMeResponse, TUserPublic } from '@racing/shared';
import * as bcrypt from 'bcrypt';
import { toUserPublic } from '../common/user-mapper';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCESS_TOKEN_EXPIRES,
  REFRESH_TOKEN_TTL_MS,
  type TJwtPayload,
  type TJwtUser,
} from './auth.types';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

const normalizeNickname = (nickname: string): string => nickname.trim().toLowerCase();

const hashRefreshToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/** Внутренняя выдача: access в JSON, refresh уходит только в cookie */
export type TIssuedAuth = {
  user: TUserPublic;
  accessToken: string;
  refreshToken: string;
};

/**
 * Регистрация, логин и JWT access + opaque refresh-сессии в БД.
 * Класс нужен Nest DI; методы без HTTP-декораторов можно писать стрелками.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  register = async (dto: RegisterDto): Promise<TIssuedAuth> => {
    const nickname = normalizeNickname(dto.nickname);
    const existing = await this.prisma.user.findUnique({ where: { nickname } });
    if (existing) {
      throw new ConflictException('Ник уже занят');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        nickname,
        passwordHash,
      },
    });

    const tokens = await this.issueTokens({ sub: user.id, nickname: user.nickname });
    return {
      user: toUserPublic(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  };

  login = async (dto: LoginDto): Promise<TIssuedAuth> => {
    const nickname = normalizeNickname(dto.nickname);
    const user = await this.prisma.user.findUnique({ where: { nickname } });
    if (!user) {
      throw new UnauthorizedException('Неверный ник или пароль');
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Неверный ник или пароль');
    }

    const tokens = await this.issueTokens({ sub: user.id, nickname: user.nickname });
    return {
      user: toUserPublic(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  };

  refresh = async (refreshToken: string | undefined): Promise<TIssuedAuth> => {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh-токен недействителен');
    }

    const tokenHash = hashRefreshToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({ where: { tokenHash } });

    if (!session) {
      throw new UnauthorizedException('Refresh-токен недействителен');
    }

    if (session.revokedAt) {
      if (session.replacedById) {
        await this.prisma.refreshSession.updateMany({
          where: { userId: session.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException('Refresh-токен недействителен');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh-токен недействителен');
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    const tokens = await this.issueTokens(
      { sub: user.id, nickname: user.nickname },
      { rotateFromSessionId: session.id },
    );
    return {
      user: toUserPublic(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  };

  /** Идемпотентный revoke refresh-сессии (logout) */
  logout = async (refreshToken: string | undefined): Promise<void> => {
    if (!refreshToken) {
      return;
    }
    const tokenHash = hashRefreshToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({ where: { tokenHash } });
    if (!session || session.revokedAt) {
      return;
    }
    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
  };

  me = async (jwtUser: TJwtUser): Promise<TMeResponse> => {
    const user = await this.prisma.user.findUnique({
      where: { id: jwtUser.userId },
      include: { raceResults: { include: { track: true }, orderBy: { timeMs: 'asc' } } },
    });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    const bestByTrack = new Map<
      string,
      { trackId: string; trackSlug: string; trackName: string; timeMs: number; createdAt: Date }
    >();
    for (const result of user.raceResults) {
      if (!bestByTrack.has(result.trackId)) {
        bestByTrack.set(result.trackId, {
          trackId: result.trackId,
          trackSlug: result.track.slug,
          trackName: result.track.name,
          timeMs: result.timeMs,
          createdAt: result.createdAt,
        });
      }
    }

    return {
      user: toUserPublic(user),
      bestResults: [...bestByTrack.values()].map((row) => ({
        trackId: row.trackId,
        trackSlug: row.trackSlug,
        trackName: row.trackName,
        timeMs: row.timeMs,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  };

  /**
   * Access JWT + opaque refresh в БД (hash).
   * При ротации помечает старую сессию revoked и ставит replacedById.
   */
  private issueTokens = async (
    payload: TJwtPayload,
    options?: { rotateFromSessionId?: string },
  ): Promise<TAuthTokens & { refreshToken: string }> => {
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: ACCESS_TOKEN_EXPIRES,
    });

    const refreshToken = randomBytes(32).toString('hex');
    const tokenHash = hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    const session = await this.prisma.refreshSession.create({
      data: {
        userId: payload.sub,
        tokenHash,
        expiresAt,
      },
    });

    if (options?.rotateFromSessionId) {
      await this.prisma.refreshSession.update({
        where: { id: options.rotateFromSessionId },
        data: {
          revokedAt: new Date(),
          replacedById: session.id,
        },
      });
    }

    return { accessToken, refreshToken };
  };
}

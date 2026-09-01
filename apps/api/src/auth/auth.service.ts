import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthResponse, AuthTokens, MeResponse } from '@racing/shared';
import * as bcrypt from 'bcrypt';
import { toUserPublic } from '../common/user-mapper';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCESS_TOKEN_EXPIRES,
  REFRESH_TOKEN_EXPIRES,
  type JwtPayload,
  type JwtUser,
} from './auth.types';
import type { LoginDto } from './dto/login.dto';
import type { RefreshDto } from './dto/refresh.dto';
import type { RegisterDto } from './dto/register.dto';

const normalizeNickname = (nickname: string): string => nickname.trim().toLowerCase();

/**
 * Регистрация, логин и JWT.
 * Класс нужен Nest DI; методы без HTTP-декораторов можно писать стрелками.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  register = async (dto: RegisterDto): Promise<AuthResponse> => {
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

    return {
      user: toUserPublic(user),
      tokens: this.issueTokens({ sub: user.id, nickname: user.nickname }),
    };
  };

  login = async (dto: LoginDto): Promise<AuthResponse> => {
    const nickname = normalizeNickname(dto.nickname);
    const user = await this.prisma.user.findUnique({ where: { nickname } });
    if (!user) {
      throw new UnauthorizedException('Неверный ник или пароль');
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Неверный ник или пароль');
    }

    return {
      user: toUserPublic(user),
      tokens: this.issueTokens({ sub: user.id, nickname: user.nickname }),
    };
  };

  refresh = async (dto: RefreshDto): Promise<{ tokens: AuthTokens }> => {
    try {
      const payload = this.jwtService.verify<JwtPayload>(dto.refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) {
        throw new UnauthorizedException('Пользователь не найден');
      }
      return { tokens: this.issueTokens({ sub: user.id, nickname: user.nickname }) };
    } catch {
      throw new UnauthorizedException('Refresh-токен недействителен');
    }
  };

  me = async (jwtUser: JwtUser): Promise<MeResponse> => {
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

  /** Выпускает пару access/refresh с разными секретами */
  private issueTokens = (payload: JwtPayload): AuthTokens => {
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: ACCESS_TOKEN_EXPIRES,
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: REFRESH_TOKEN_EXPIRES,
    });
    return { accessToken, refreshToken };
  };
}

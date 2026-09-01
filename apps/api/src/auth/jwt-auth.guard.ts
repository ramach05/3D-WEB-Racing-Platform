import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload, JwtUser } from './auth.types';

type IncomingRequest = {
  headers: { authorization?: string };
  user?: JwtUser;
};

/**
 * Проверяет Bearer access JWT.
 * Класс нужен Nest Guard; метод canActivate — прототип, иначе декоратор контекста не сработает.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<IncomingRequest>();
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Нужен Bearer-токен');
    }

    const token = header.slice('Bearer '.length);
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });
      request.user = { userId: payload.sub, nickname: payload.nickname };
      return true;
    } catch {
      throw new UnauthorizedException('Токен недействителен');
    }
  }
}

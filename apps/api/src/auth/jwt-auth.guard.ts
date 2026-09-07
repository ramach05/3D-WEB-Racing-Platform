import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { TJwtPayload, TJwtUser } from './auth.types';

type TIncomingRequest = {
  headers: { authorization?: string };
  user?: TJwtUser;
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
    const request = context.switchToHttp().getRequest<TIncomingRequest>();
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Нужен Bearer-токен');
    }

    const token = header.slice('Bearer '.length);
    try {
      const payload = this.jwtService.verify<TJwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });
      request.user = { userId: payload.sub, nickname: payload.nickname };
      return true;
    } catch {
      throw new UnauthorizedException('Токен недействителен');
    }
  }
}

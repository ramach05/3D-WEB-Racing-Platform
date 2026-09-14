import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { TAuthResponse, TRefreshResponse } from '@racing/shared';
import type { Request, Response } from 'express';
import { clearRefreshCookie, REFRESH_COOKIE_NAME, setRefreshCookie } from './auth-cookies';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { TJwtUser } from './auth.types';

type TAuthedCookieRequest = Request & {
  cookies?: Record<string, string | undefined>;
};

/**
 * HTTP-слой auth.
 * Класс и методы прототипа нужны Nest для декораторов маршрутов.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Регистрация (refresh → httpOnly cookie)' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TAuthResponse> {
    const issued = await this.authService.register(dto);
    setRefreshCookie(res, issued.refreshToken);
    return { user: issued.user, tokens: { accessToken: issued.accessToken } };
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Логин (refresh → httpOnly cookie)' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TAuthResponse> {
    const issued = await this.authService.login(dto);
    setRefreshCookie(res, issued.refreshToken);
    return { user: issued.user, tokens: { accessToken: issued.accessToken } };
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Обновить access по refresh-cookie (ротация)' })
  async refresh(
    @Req() req: TAuthedCookieRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TRefreshResponse> {
    const issued = await this.authService.refresh(req.cookies?.[REFRESH_COOKIE_NAME]);
    setRefreshCookie(res, issued.refreshToken);
    return { tokens: { accessToken: issued.accessToken } };
  }

  @Post('logout')
  @HttpCode(204)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Выход: revoke refresh-сессии и clear cookie' })
  async logout(
    @Req() req: TAuthedCookieRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(req.cookies?.[REFRESH_COOKIE_NAME]);
    clearRefreshCookie(res);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Текущий пользователь и личные лучшие времена' })
  me(@CurrentUser() user: TJwtUser) {
    return this.authService.me(user);
  }
}

import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { TAuthResponse, TRefreshResponse } from '@racing/shared';
import type { Request, Response } from 'express';
import { clearRefreshCookie, REFRESH_COOKIE_NAME, setRefreshCookie } from './auth-cookies';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CSRF_HEADER_NAME, type TJwtUser } from './auth.types';

/**
 * CSRF-защита cookie-эндпоинтов: браузер обязан прислать кастомный заголовок,
 * который невозможно добавить кросс-сайтом без успешного CORS-preflight.
 * Требуется только когда refresh-cookie реально есть — гость без cookie не мишень.
 * При sameSite=lax это двойная страховка, при sameSite=none — обязательная проверка.
 */
const assertCsrfWhenAuthed = (
  cookieToken: string | undefined,
  requestedWith: string | undefined,
): void => {
  if (cookieToken && !requestedWith) {
    throw new ForbiddenException(`Нужен заголовок ${CSRF_HEADER_NAME}`);
  }
};

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
  @ApiHeader({ name: CSRF_HEADER_NAME, description: 'CSRF-маркер своего XHR', required: true })
  async refresh(
    @Req() req: TAuthedCookieRequest,
    @Res() res: Response,
    @Headers(CSRF_HEADER_NAME) requestedWith?: string,
  ): Promise<void> {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    assertCsrfWhenAuthed(refreshToken, requestedWith);
    // Гость без cookie: пустой 204 вместо 401 (молчаливая гидрация, без ошибки в консоли браузера)
    if (!refreshToken) {
      res.status(204).end();
      return;
    }
    const issued = await this.authService.refresh(refreshToken);
    setRefreshCookie(res, issued.refreshToken);
    res
      .status(200)
      .json({ tokens: { accessToken: issued.accessToken } } satisfies TRefreshResponse);
  }

  @Post('logout')
  @HttpCode(204)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Выход: revoke refresh-сессии и clear cookie' })
  @ApiHeader({ name: CSRF_HEADER_NAME, description: 'CSRF-маркер своего XHR', required: true })
  async logout(
    @Req() req: TAuthedCookieRequest,
    @Res({ passthrough: true }) res: Response,
    @Headers(CSRF_HEADER_NAME) requestedWith?: string,
  ): Promise<void> {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    assertCsrfWhenAuthed(refreshToken, requestedWith);
    await this.authService.logout(refreshToken);
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

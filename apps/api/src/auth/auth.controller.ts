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
 * CSRF protection for cookie endpoints: the browser must send a custom header
 * that a cross-site request cannot add without a successful CORS preflight.
 * Required only when a refresh cookie is actually present — a guest without a cookie is not a target.
 * With sameSite=lax this is belt and braces; with sameSite=none it is mandatory.
 */
const assertCsrfWhenAuthed = (
  cookieToken: string | undefined,
  requestedWith: string | undefined,
): void => {
  if (cookieToken && !requestedWith) {
    throw new ForbiddenException(`Missing ${CSRF_HEADER_NAME} header`);
  }
};

type TAuthedCookieRequest = Request & {
  cookies?: Record<string, string | undefined>;
};

/** Auth HTTP layer. Class and prototype methods are required by Nest for route decorators. */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register (refresh → httpOnly cookie)' })
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
  @ApiOperation({ summary: 'Login (refresh → httpOnly cookie)' })
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
  @ApiOperation({ summary: 'Refresh access token via refresh cookie (rotation)' })
  @ApiHeader({ name: CSRF_HEADER_NAME, description: 'CSRF marker of an own XHR', required: true })
  async refresh(
    @Req() req: TAuthedCookieRequest,
    @Res() res: Response,
    @Headers(CSRF_HEADER_NAME) requestedWith?: string,
  ): Promise<void> {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    assertCsrfWhenAuthed(refreshToken, requestedWith);
    // Guest without a cookie: empty 204 instead of 401 (silent hydration, no browser console error)
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
  @ApiOperation({ summary: 'Logout: revoke the refresh session and clear the cookie' })
  @ApiHeader({ name: CSRF_HEADER_NAME, description: 'CSRF marker of an own XHR', required: true })
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
  @ApiOperation({ summary: 'Current user and personal best times' })
  me(@CurrentUser() user: TJwtUser) {
    return this.authService.me(user);
  }
}

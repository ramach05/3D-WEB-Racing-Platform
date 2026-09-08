import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { TJwtUser } from './auth.types';
import { JwtAuthGuard } from './jwt-auth.guard';

const createContext = (authorization?: string) => {
  const request: { headers: { authorization?: string }; user?: TJwtUser } = {
    headers: { authorization },
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    request,
  };
};

describe('JwtAuthGuard', () => {
  it('rejects missing bearer header', () => {
    const guard = new JwtAuthGuard(
      { verify: vi.fn() } as never,
      { getOrThrow: vi.fn(() => 'secret') } as never,
    );
    const ctx = createContext();

    expect(() => guard.canActivate(ctx as never)).toThrow(UnauthorizedException);
  });

  it('rejects invalid token', () => {
    const guard = new JwtAuthGuard(
      {
        verify: vi.fn(() => {
          throw new Error('bad');
        }),
      } as never,
      { getOrThrow: vi.fn(() => 'secret') } as never,
    );
    const ctx = createContext('Bearer bad-token');

    expect(() => guard.canActivate(ctx as never)).toThrow(UnauthorizedException);
  });

  it('sets request user for valid token', () => {
    const guard = new JwtAuthGuard(
      {
        verify: vi.fn(() => ({ sub: 'u1', nickname: 'racer' })),
      } as never,
      { getOrThrow: vi.fn(() => 'secret') } as never,
    );
    const ctx = createContext('Bearer good-token');

    expect(guard.canActivate(ctx as never)).toBe(true);
    expect(ctx.request.user).toEqual({ userId: 'u1', nickname: 'racer' });
  });
});

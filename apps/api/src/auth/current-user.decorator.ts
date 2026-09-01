import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { JwtUser } from './auth.types';

type AuthedRequest = {
  user: JwtUser;
};

/** Достаёт пользователя, которого положил JwtAuthGuard */
export const CurrentUser = createParamDecorator(
  (_data: undefined, ctx: ExecutionContext): JwtUser => {
    const request = ctx.switchToHttp().getRequest<AuthedRequest>();
    return request.user;
  },
);

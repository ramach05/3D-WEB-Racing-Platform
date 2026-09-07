import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { TJwtUser } from './auth.types';

type TAuthedRequest = {
  user: TJwtUser;
};

/** Достаёт пользователя, которого положил JwtAuthGuard */
export const CurrentUser = createParamDecorator(
  (_data: undefined, ctx: ExecutionContext): TJwtUser => {
    const request = ctx.switchToHttp().getRequest<TAuthedRequest>();
    return request.user;
  },
);

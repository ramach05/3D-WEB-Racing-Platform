import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import type { TRefreshRequest } from '@racing/shared';

/** DTO обновления access-токена. Class нужен class-validator и Swagger. */
export class RefreshDto implements TRefreshRequest {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  refreshToken: string;
}

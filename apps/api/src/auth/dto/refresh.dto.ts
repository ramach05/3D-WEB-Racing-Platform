import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import type { RefreshRequest } from '@racing/shared';

/** DTO обновления access-токена. Class нужен class-validator и Swagger. */
export class RefreshDto implements RefreshRequest {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  refreshToken: string;
}

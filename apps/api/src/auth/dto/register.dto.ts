import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { TRegisterRequest } from '@racing/shared';

/** Register DTO. Class is required by class-validator and Swagger. */
export class RegisterDto implements TRegisterRequest {
  @ApiProperty({ example: 'racer_01', minLength: 3, maxLength: 20 })
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Nickname: latin letters, digits and _ only' })
  nickname: string;

  @ApiProperty({ minLength: 4, maxLength: 128, example: '1234' })
  @IsString()
  @MinLength(4)
  @MaxLength(128)
  password: string;
}

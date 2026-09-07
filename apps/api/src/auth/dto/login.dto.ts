import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';
import type { TLoginRequest } from '@racing/shared';

/** DTO логина. Class нужен class-validator и Swagger. */
export class LoginDto implements TLoginRequest {
  @ApiProperty({ example: 'test_user', minLength: 3, maxLength: 20 })
  @IsString()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Ник: только латиница, цифры и _' })
  nickname: string;

  @ApiProperty({ minLength: 4, example: '1234' })
  @IsString()
  @MinLength(4)
  password: string;
}

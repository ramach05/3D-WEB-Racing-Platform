import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Max, Min } from 'class-validator';
import { RACE_TIME_MAX_MS, RACE_TIME_MIN_MS, type TCreateRaceResultRequest } from '@racing/shared';

/** DTO результата заезда. Class нужен class-validator и Swagger. */
export class CreateRaceResultDto implements TCreateRaceResultRequest {
  @ApiProperty()
  @IsString()
  trackId: string;

  @ApiProperty({ minimum: RACE_TIME_MIN_MS, maximum: RACE_TIME_MAX_MS })
  @IsInt()
  @Min(RACE_TIME_MIN_MS)
  @Max(RACE_TIME_MAX_MS)
  timeMs: number;
}

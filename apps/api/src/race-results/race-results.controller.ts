import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { TJwtUser } from '../auth/auth.types';
import { CreateRaceResultDto } from './dto/create-race-result.dto';
import { RaceResultsService } from './race-results.service';

/** HTTP-слой результатов. Класс и методы прототипа нужны Nest. */
@ApiTags('race-results')
@Controller()
export class RaceResultsController {
  constructor(private readonly raceResultsService: RaceResultsService) {}

  @Post('race-results')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Сохранить время заезда' })
  create(@CurrentUser() user: TJwtUser, @Body() dto: CreateRaceResultDto) {
    return this.raceResultsService.create(user, dto);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Лучшие личные времена по трассе' })
  @ApiQuery({ name: 'trackSlug', required: true })
  leaderboard(@Query('trackSlug') trackSlug?: string) {
    if (!trackSlug) {
      throw new BadRequestException('Нужен trackSlug');
    }
    return this.raceResultsService.leaderboard(trackSlug);
  }
}

import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtUser } from '../auth/auth.types';
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
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateRaceResultDto) {
    return this.raceResultsService.create(user, dto);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Лучшие личные времена по трассе' })
  @ApiQuery({ name: 'trackId', required: true })
  leaderboard(@Query('trackId') trackId?: string) {
    if (!trackId) {
      throw new BadRequestException('Нужен trackId');
    }
    return this.raceResultsService.leaderboard(trackId);
  }
}

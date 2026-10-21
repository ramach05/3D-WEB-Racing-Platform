import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { TJwtUser } from '../auth/auth.types';
import { CreateRaceResultDto } from './dto/create-race-result.dto';
import { RaceResultsService } from './race-results.service';

@ApiTags('race-results')
@Controller()
export class RaceResultsController {
  constructor(private readonly raceResultsService: RaceResultsService) {}

  @Post('race-results')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save a race time' })
  create(@CurrentUser() user: TJwtUser, @Body() dto: CreateRaceResultDto) {
    return this.raceResultsService.create(user, dto);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Best personal times on a track' })
  @ApiQuery({ name: 'trackSlug', required: true })
  leaderboard(@Query('trackSlug') trackSlug?: string) {
    if (!trackSlug) {
      throw new BadRequestException('trackSlug is required');
    }
    return this.raceResultsService.leaderboard(trackSlug);
  }

  @Get('leaderboard/:slug')
  @ApiOperation({ summary: 'Best personal times on a track (by slug)' })
  leaderboardBySlug(@Param('slug') slug: string) {
    return this.raceResultsService.leaderboard(slug);
  }
}

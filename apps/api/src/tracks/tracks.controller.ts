import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TracksService } from './tracks.service';

/** Tracks HTTP layer. Class and prototype methods are required by Nest. */
@ApiTags('tracks')
@Controller('tracks')
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @Get()
  @ApiOperation({ summary: 'List of tracks' })
  list() {
    return this.tracksService.list();
  }
}

import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TracksService } from './tracks.service';

/** HTTP-слой трасс. Класс и методы прототипа нужны Nest. */
@ApiTags('tracks')
@Controller('tracks')
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @Get()
  @ApiOperation({ summary: 'Список трасс' })
  list() {
    return this.tracksService.list();
  }
}

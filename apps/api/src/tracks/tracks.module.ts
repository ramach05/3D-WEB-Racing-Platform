import { Module } from '@nestjs/common';
import { TracksController } from './tracks.controller';
import { TracksService } from './tracks.service';

/** Модуль трасс. Класс — требование Nest Module. */
@Module({
  controllers: [TracksController],
  providers: [TracksService],
})
export class TracksModule {}

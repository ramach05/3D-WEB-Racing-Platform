import { Module } from '@nestjs/common';
import { TracksController } from './tracks.controller';
import { TracksService } from './tracks.service';

/** Tracks module. Class is a Nest Module requirement. */
@Module({
  controllers: [TracksController],
  providers: [TracksService],
})
export class TracksModule {}

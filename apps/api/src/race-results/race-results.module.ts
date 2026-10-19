import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RaceResultsController } from './race-results.controller';
import { RaceResultsService } from './race-results.service';

/** Race results module. Class is a Nest Module requirement. */
@Module({
  imports: [AuthModule],
  controllers: [RaceResultsController],
  providers: [RaceResultsService],
})
export class RaceResultsModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RaceResultsController } from './race-results.controller';
import { RaceResultsService } from './race-results.service';

/** Модуль результатов заезда. Класс — требование Nest Module. */
@Module({
  imports: [AuthModule],
  controllers: [RaceResultsController],
  providers: [RaceResultsService],
})
export class RaceResultsModule {}

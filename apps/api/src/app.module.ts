import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RaceResultsModule } from './race-results/race-results.module';
import { TracksModule } from './tracks/tracks.module';

/** Корневой модуль API. Класс — требование Nest Module. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    TracksModule,
    RaceResultsModule,
  ],
})
export class AppModule {}

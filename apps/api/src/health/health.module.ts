import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/** Модуль проверки живости API. Класс — требование Nest Module. */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}

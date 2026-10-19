import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/** API liveness module. Class is a Nest Module requirement. */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}

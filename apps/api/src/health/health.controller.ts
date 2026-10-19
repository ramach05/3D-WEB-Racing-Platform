import { Controller, Get } from '@nestjs/common';

/** Health endpoint. Class and prototype methods are required by Nest: the Get decorator doesn't work on arrow fields. */
@Controller('health')
export class HealthController {
  /** Returns a status to check that the API is alive */
  @Get()
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }
}

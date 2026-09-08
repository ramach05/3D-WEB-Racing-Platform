import { Controller, Get } from '@nestjs/common';

/**
 * Health-эндпоинт.
 * Класс и методы прототипа нужны Nest: декоратор Get не вешается на стрелочное поле.
 */
@Controller('health')
export class HealthController {
  /** Отдаёт статус, чтобы проверить, что API жив */
  @Get()
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }
}

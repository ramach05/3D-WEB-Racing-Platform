import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Глобальный доступ к Prisma. Класс — требование Nest Module. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

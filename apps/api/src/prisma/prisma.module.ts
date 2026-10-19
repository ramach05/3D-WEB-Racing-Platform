import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Global Prisma access. Class is a Nest Module requirement. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

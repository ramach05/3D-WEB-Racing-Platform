import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Prisma-клиент как Nest-провайдер с SQLite driver adapter (Prisma 7).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
    const adapter = new PrismaBetterSqlite3({ url });
    super({ adapter });
  }

  /** Открывает соединение при старте приложения */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /** Закрывает соединение при остановке */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

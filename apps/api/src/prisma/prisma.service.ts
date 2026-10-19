import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client';

/** Prisma client as a Nest provider with a SQLite driver adapter (Prisma 7). */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
    const adapter = new PrismaBetterSqlite3({ url });
    super({ adapter });
  }

  /** Opens the connection on application startup */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /** Closes the connection on shutdown */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

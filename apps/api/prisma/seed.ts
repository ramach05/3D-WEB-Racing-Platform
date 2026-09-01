import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { TRACK_SLUG_COASTAL_OVAL, TRACK_SLUG_NIGHT_CITY } from '@racing/shared';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client';

const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

const TEST_PASSWORD = '1234';

/** Заполняет локальную БД трассами, тестовыми пользователями и парой результатов */
const seed = async (): Promise<void> => {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  const coastal = await prisma.track.upsert({
    where: { slug: TRACK_SLUG_COASTAL_OVAL },
    update: { name: 'Coastal Oval', isAvailable: true },
    create: { slug: TRACK_SLUG_COASTAL_OVAL, name: 'Coastal Oval', isAvailable: true },
  });

  const nightCity = await prisma.track.upsert({
    where: { slug: TRACK_SLUG_NIGHT_CITY },
    update: { name: 'Night City', isAvailable: true },
    create: { slug: TRACK_SLUG_NIGHT_CITY, name: 'Night City', isAvailable: true },
  });

  const testUser = await prisma.user.upsert({
    where: { nickname: 'test_user' },
    update: { passwordHash },
    create: { nickname: 'test_user', passwordHash },
  });

  const rival = await prisma.user.upsert({
    where: { nickname: 'rival_racer' },
    update: { passwordHash },
    create: { nickname: 'rival_racer', passwordHash },
  });

  await prisma.raceResult.deleteMany({
    where: { userId: { in: [testUser.id, rival.id] } },
  });

  await prisma.raceResult.createMany({
    data: [
      { userId: testUser.id, trackId: coastal.id, timeMs: 42_350 },
      { userId: rival.id, trackId: coastal.id, timeMs: 40_120 },
      { userId: testUser.id, trackId: nightCity.id, timeMs: 28_900 },
    ],
  });
};

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: { message?: string; toString: () => string }) => {
    console.error(error.message ?? error.toString());
    await prisma.$disconnect();
    process.exit(1);
  });

import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { TRACK_SLUG_COASTAL_OVAL, TRACK_SLUG_NIGHT_CITY } from '@racing/shared';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client';

const url = process.env.DATABASE_URL ?? 'file:./dev.db';
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

const TEST_PASSWORD = '1234';

/** Демо-ники для заполнения таблицы лидеров */
const DEMO_NICKNAMES = [
  'rival_racer',
  'neon_fox',
  'drift_king',
  'turbo_mia',
  'apex_wolf',
  'volt_rider',
  'pixel_ace',
  'shadow_lap',
  'chrome_dash',
  'blaze_nova',
] as const;

/** Лучшие времена на Coastal Oval */
const COASTAL_TIMES_MS = [
  27_450, // rival_racer
  27_980, // neon_fox
  28_400, // drift_king
  28_900, // turbo_mia
  29_350, // apex_wolf
  29_880, // volt_rider
  30_520, // pixel_ace
  31_050, // shadow_lap
  46_480, // chrome_dash — 00:46.48
  44_700, // test_user
] as const;

/** Лучшие времена на Night City */
const NIGHT_TIMES_MS = [
  39_840, // neon_fox
  40_120, // rival_racer
  40_550, // blaze_nova
  41_480, // turbo_mia
  42_050, // volt_rider
  42_350, // apex_wolf
  56_900, // test_user
] as const;

/** Фиксированные даты демо-заездов (январь–август 2026) */
const COASTAL_DATES = [
  '2026-01-14T11:20:00.000Z', // rival_racer
  '2026-02-03T16:45:00.000Z', // neon_fox
  '2026-02-27T09:10:00.000Z', // drift_king
  '2026-03-11T18:30:00.000Z', // turbo_mia
  '2026-04-02T13:05:00.000Z', // apex_wolf
  '2026-05-19T20:40:00.000Z', // volt_rider
  '2026-06-08T08:55:00.000Z', // pixel_ace
  '2026-07-22T15:15:00.000Z', // shadow_lap
  '2026-08-16T19:50:00.000Z', // chrome_dash
  '2026-09-01T12:00:00.000Z', // test_user
] as const;

const NIGHT_DATES = [
  '2026-01-28T21:15:00.000Z', // neon_fox
  '2026-03-06T22:40:00.000Z', // rival_racer
  '2026-04-17T20:05:00.000Z', // blaze_nova
  '2026-05-29T23:25:00.000Z', // turbo_mia
  '2026-06-21T19:50:00.000Z', // volt_rider
  '2026-08-09T21:35:00.000Z', // apex_wolf
  '2026-09-01T12:00:00.000Z', // test_user
] as const;

/** Заполняет локальную БД трассами, тестовыми пользователями и результатами лидеров */
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

  const demoUsers = [];
  for (const nickname of DEMO_NICKNAMES) {
    const user = await prisma.user.upsert({
      where: { nickname },
      update: { passwordHash },
      create: { nickname, passwordHash },
    });
    demoUsers.push(user);
  }

  await prisma.raceResult.deleteMany();

  const byNick = new Map<string, string>([
    ['test_user', testUser.id],
    ...demoUsers.map((user): [string, string] => [user.nickname, user.id]),
  ]);

  const userIdOf = (nickname: string): string => {
    const id = byNick.get(nickname);
    if (!id) {
      throw new Error(`Seed user missing: ${nickname}`);
    }
    return id;
  };

  const coastalRacers = [
    'rival_racer',
    'neon_fox',
    'drift_king',
    'turbo_mia',
    'apex_wolf',
    'volt_rider',
    'pixel_ace',
    'shadow_lap',
    'chrome_dash',
    'test_user',
  ] as const;

  const nightRacers = [
    'neon_fox',
    'rival_racer',
    'blaze_nova',
    'turbo_mia',
    'volt_rider',
    'apex_wolf',
    'test_user',
  ] as const;

  await prisma.raceResult.createMany({
    data: [
      ...coastalRacers.map((nickname, index) => ({
        userId: userIdOf(nickname),
        trackId: coastal.id,
        timeMs: COASTAL_TIMES_MS[index],
        createdAt: new Date(COASTAL_DATES[index]),
      })),
      ...nightRacers.map((nickname, index) => ({
        userId: userIdOf(nickname),
        trackId: nightCity.id,
        timeMs: NIGHT_TIMES_MS[index],
        createdAt: new Date(NIGHT_DATES[index]),
      })),
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

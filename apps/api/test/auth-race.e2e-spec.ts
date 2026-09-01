import { execSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';

process.env.JWT_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.DATABASE_URL = 'file:./test.db';

const apiRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');

type AuthBody = {
  user: { id: string; nickname: string };
  tokens: { accessToken: string; refreshToken: string };
};

type TrackBody = {
  id: string;
  slug: string;
  isAvailable: boolean;
};

/** Поднимает приложение с отдельной SQLite и прогоняет критичный путь API */
describe('API e2e', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    const testDbPath = join(apiRoot, 'prisma', 'test.db');
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    execSync('npx prisma migrate deploy', {
      cwd: apiRoot,
      env: { ...process.env, DATABASE_URL: 'file:./test.db' },
      stdio: 'pipe',
    });
    execSync('npx prisma db seed', {
      cwd: apiRoot,
      env: { ...process.env, DATABASE_URL: 'file:./test.db' },
      stdio: 'pipe',
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    server = app.getHttpServer();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  }, 10_000);

  it('registers, logs in and returns the current user', async () => {
    const nickname = `racer_${Date.now()}`;

    const register = await request(server)
      .post('/auth/register')
      .send({ nickname, password: '1234' })
      .expect(201);

    const registerBody = register.body as AuthBody;
    expect(registerBody.user.nickname).toBe(nickname.toLowerCase());
    expect(registerBody.tokens.accessToken.length).toBeGreaterThan(10);

    const login = await request(server)
      .post('/auth/login')
      .send({ nickname, password: '1234' })
      .expect(201);

    const loginBody = login.body as AuthBody;
    const me = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginBody.tokens.accessToken}`)
      .expect(200);

    expect((me.body as { user: { nickname: string } }).user.nickname).toBe(nickname.toLowerCase());
  });

  it('rejects invalid login', async () => {
    await request(server)
      .post('/auth/login')
      .send({ nickname: 'nobody_here', password: '1234' })
      .expect(401);
  });

  it('rejects unauthorized race result', async () => {
    await request(server).post('/race-results').send({ trackId: 'x', timeMs: 20_000 }).expect(401);
  });

  it('rejects too fast race time and accepts a valid one', async () => {
    const login = await request(server)
      .post('/auth/login')
      .send({ nickname: 'test_user', password: '1234' })
      .expect(201);
    const accessToken = (login.body as AuthBody).tokens.accessToken;

    const tracks = await request(server).get('/tracks').expect(200);
    const coastal = (tracks.body as TrackBody[]).find((track) => track.slug === 'coastal-oval');
    expect(coastal).toBeDefined();
    const trackId = coastal?.id ?? '';

    await request(server)
      .post('/race-results')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ trackId, timeMs: 100 })
      .expect(400);

    await request(server)
      .post('/race-results')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ trackId, timeMs: 33_000 })
      .expect(201);

    const board = await request(server).get('/leaderboard').query({ trackId }).expect(200);
    const entries = board.body as Array<{ nickname: string; timeMs: number }>;
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((row) => row.nickname === 'test_user')).toBe(true);
  });
});

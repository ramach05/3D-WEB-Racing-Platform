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

type TAuthBody = {
  user: { id: string; nickname: string };
  tokens: { accessToken: string; refreshToken: string };
};

type TTrackBody = {
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

    const registerBody = register.body as TAuthBody;
    expect(registerBody.user.nickname).toBe(nickname.toLowerCase());
    expect(registerBody.tokens.accessToken.length).toBeGreaterThan(10);

    const login = await request(server)
      .post('/auth/login')
      .send({ nickname, password: '1234' })
      .expect(201);

    const loginBody = login.body as TAuthBody;
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
    const accessToken = (login.body as TAuthBody).tokens.accessToken;

    const tracks = await request(server).get('/tracks').expect(200);
    const coastal = (tracks.body as TTrackBody[]).find((track) => track.slug === 'coastal-oval');
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

    const board = await request(server)
      .get('/leaderboard')
      .query({ trackSlug: coastal?.slug })
      .expect(200);
    const entries = board.body as Array<{ nickname: string; timeMs: number }>;
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((row) => row.nickname === 'test_user')).toBe(true);
  });

  it('refreshes tokens and rejects invalid refresh', async () => {
    const login = await request(server)
      .post('/auth/login')
      .send({ nickname: 'test_user', password: '1234' })
      .expect(201);
    const refreshToken = (login.body as TAuthBody).tokens.refreshToken;

    const refreshed = await request(server)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(201);
    const accessToken = (refreshed.body as { tokens: { accessToken: string } }).tokens.accessToken;

    await request(server).get('/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);

    await request(server)
      .post('/auth/refresh')
      .send({
        refreshToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4Iiwibmlja25hbWUiOiJ4In0.invalid',
      })
      .expect(401);
  });

  it('rejects duplicate register', async () => {
    const nickname = `dup_${Date.now()}`;
    await request(server).post('/auth/register').send({ nickname, password: '1234' }).expect(201);
    await request(server).post('/auth/register').send({ nickname, password: '1234' }).expect(409);
  });

  it('requires trackSlug for leaderboard and returns best results on me', async () => {
    await request(server).get('/leaderboard').expect(400);

    const login = await request(server)
      .post('/auth/login')
      .send({ nickname: 'test_user', password: '1234' })
      .expect(201);
    const accessToken = (login.body as TAuthBody).tokens.accessToken;

    const tracks = await request(server).get('/tracks').expect(200);
    const coastal = (tracks.body as TTrackBody[]).find((track) => track.slug === 'coastal-oval');
    expect(coastal).toBeDefined();

    await request(server)
      .post('/race-results')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ trackId: coastal?.id, timeMs: 34_000 })
      .expect(201);

    const me = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const bestResults = (me.body as { bestResults: Array<{ trackId: string; timeMs: number }> })
      .bestResults;
    expect(bestResults.some((row) => row.trackId === coastal?.id)).toBe(true);
  });

  it('returns health status', async () => {
    const health = await request(server).get('/health').expect(200);
    expect(health.body).toEqual({ status: 'ok' });
  });
});

import { http, HttpResponse } from 'msw';
import { TRACK_SLUG_COASTAL_OVAL, TRACK_SLUG_STORM_EIGHT } from '@racing/shared';
import { getApiBaseUrl } from '@/shared/config';

const api = getApiBaseUrl();

export const mockUser = {
  id: 'user-1',
  nickname: 'racer_one',
  createdAt: '2024-01-01T00:00:00.000Z',
};

export const mockTracks = [
  {
    id: 'track-1',
    slug: TRACK_SLUG_COASTAL_OVAL,
    name: 'Coastal Oval',
    isAvailable: true,
  },
  {
    id: 'track-3',
    slug: TRACK_SLUG_STORM_EIGHT,
    name: 'Storm Eight',
    isAvailable: true,
  },
];

export const mockMe = {
  user: mockUser,
  bestResults: [
    {
      trackId: 'track-1',
      trackSlug: TRACK_SLUG_COASTAL_OVAL,
      trackName: 'Coastal Oval',
      timeMs: 65_340,
      createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
      trackId: 'track-3',
      trackSlug: TRACK_SLUG_STORM_EIGHT,
      trackName: 'Storm Eight',
      timeMs: 58_000,
      createdAt: '2024-01-03T00:00:00.000Z',
    },
  ],
  stats: {
    totalRaces: 5,
    tracksCompleted: 2,
    totalTimeMs: 333_340,
    firstRaceAt: '2024-01-01T00:00:00.000Z',
    lastRaceAt: '2024-01-05T00:00:00.000Z',
    perTrack: [
      {
        trackId: 'track-1',
        trackSlug: TRACK_SLUG_COASTAL_OVAL,
        trackName: 'Coastal Oval',
        races: 3,
        bestTimeMs: 65_340,
        totalTimeMs: 210_000,
        rank: 4,
        gapToLeaderMs: 5_000,
        improvementMs: 8_000,
      },
      {
        trackId: 'track-3',
        trackSlug: TRACK_SLUG_STORM_EIGHT,
        trackName: 'Storm Eight',
        races: 2,
        bestTimeMs: 58_000,
        totalTimeMs: 123_340,
        rank: 2,
        gapToLeaderMs: 1_500,
        improvementMs: 0,
      },
    ],
  },
};

export const handlers = [
  http.get(`${api}/health`, () => HttpResponse.json({ status: 'ok' })),
  http.get(`${api}/tracks`, () => HttpResponse.json(mockTracks)),
  http.post(`${api}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { nickname?: string; password?: string };
    if (body.nickname === 'bad' || body.password === 'bad1') {
      return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    return HttpResponse.json({
      user: mockUser,
      tokens: { accessToken: 'access-token' },
    });
  }),
  http.post(`${api}/auth/refresh`, () =>
    HttpResponse.json({ message: 'Unauthorized' }, { status: 401 }),
  ),
  http.post(`${api}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${api}/auth/me`, () => HttpResponse.json(mockMe)),
  http.get(`${api}/leaderboard`, () => HttpResponse.json([])),
];

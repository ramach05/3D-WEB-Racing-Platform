import { http, HttpResponse } from 'msw';
import { TRACK_SLUG_COASTAL_OVAL } from '@racing/shared';
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
  ],
};

export const handlers = [
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

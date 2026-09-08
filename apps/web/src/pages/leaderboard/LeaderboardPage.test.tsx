import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TRACK_SLUG_COASTAL_OVAL, TRACK_SLUG_NIGHT_CITY } from '@racing/shared';
import { renderWithRouter } from '@/test/render';

vi.mock('@/features/auth', () => ({
  useAuthUser: vi.fn(() => null),
}));

vi.mock('@/entities/track', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/entities/track')>();
  return {
    ...actual,
    useGetTracksQuery: vi.fn(),
  };
});

vi.mock('@/entities/leaderboard', () => ({
  useGetLeaderboardQuery: vi.fn(),
}));

import { useGetLeaderboardQuery } from '@/entities/leaderboard';
import { useGetTracksQuery } from '@/entities/track';
import { LeaderboardPage } from './LeaderboardPage';

const mockedUseGetTracksQuery = vi.mocked(useGetTracksQuery);
const mockedUseGetLeaderboardQuery = vi.mocked(useGetLeaderboardQuery);

describe('LeaderboardPage', () => {
  beforeEach(() => {
    mockedUseGetTracksQuery.mockReset();
    mockedUseGetLeaderboardQuery.mockReset();
  });

  it('renders track tabs and entries', () => {
    mockedUseGetTracksQuery.mockReturnValue({
      data: [
        {
          id: 't1',
          slug: TRACK_SLUG_COASTAL_OVAL,
          name: 'Coastal Oval',
          isAvailable: true,
        },
        {
          id: 't2',
          slug: TRACK_SLUG_NIGHT_CITY,
          name: 'Night City',
          isAvailable: true,
        },
      ],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useGetTracksQuery>);

    mockedUseGetLeaderboardQuery.mockReturnValue({
      data: [
        {
          rank: 1,
          userId: 'u1',
          nickname: 'top_racer',
          timeMs: 40_120,
          createdAt: '2026-01-01T12:00:00.000Z',
        },
      ],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useGetLeaderboardQuery>);

    renderWithRouter(<LeaderboardPage />);

    expect(screen.getByRole('tab', { name: 'Coastal Oval' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Night City' })).toBeInTheDocument();
    expect(screen.getByText('top_racer')).toBeInTheDocument();
  });

  it('shows loading while tracks load', () => {
    mockedUseGetTracksQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useGetTracksQuery>);
    mockedUseGetLeaderboardQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useGetLeaderboardQuery>);

    renderWithRouter(<LeaderboardPage />);

    expect(screen.getByText(/загружаем|loading/i)).toBeInTheDocument();
  });
});

import type * as trackEntity from '@/entities/track';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TRACK_SLUG_COASTAL_OVAL, TRACK_SLUG_NIGHT_CITY } from '@racing/shared';
import { mockQueryResult } from '@/test/mock-query-result';
import { renderWithRouter } from '@/test/render';

vi.mock('@/features/auth', () => ({
  useAuthUser: vi.fn(() => null),
}));

vi.mock('@/entities/track', async (importOriginal) => {
  const actual = await importOriginal<typeof trackEntity>();
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
import { LeaderboardPage } from './leaderboard-page';

const mockedUseGetTracksQuery = vi.mocked(useGetTracksQuery);
const mockedUseGetLeaderboardQuery = vi.mocked(useGetLeaderboardQuery);

type TTracksQuery = ReturnType<typeof useGetTracksQuery>;
type TLeaderboardQuery = ReturnType<typeof useGetLeaderboardQuery>;

describe('LeaderboardPage', () => {
  beforeEach(() => {
    mockedUseGetTracksQuery.mockReset();
    mockedUseGetLeaderboardQuery.mockReset();
  });

  it('renders track tabs and entries', () => {
    mockedUseGetTracksQuery.mockReturnValue(
      mockQueryResult<TTracksQuery>({
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
      }),
    );

    mockedUseGetLeaderboardQuery.mockReturnValue(
      mockQueryResult<TLeaderboardQuery>({
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
      }),
    );

    renderWithRouter(<LeaderboardPage />);

    expect(mockedUseGetLeaderboardQuery).toHaveBeenCalledWith(TRACK_SLUG_COASTAL_OVAL, {
      skip: false,
    });
    expect(screen.getByRole('tab', { name: 'Coastal Oval' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Night City' })).toBeInTheDocument();
    expect(screen.getByText('top_racer')).toBeInTheDocument();
  });

  it('shows loading while tracks load', () => {
    mockedUseGetTracksQuery.mockReturnValue(
      mockQueryResult<TTracksQuery>({
        data: undefined,
        isLoading: true,
        isError: false,
      }),
    );
    mockedUseGetLeaderboardQuery.mockReturnValue(
      mockQueryResult<TLeaderboardQuery>({
        data: undefined,
        isLoading: false,
        isError: false,
      }),
    );

    renderWithRouter(<LeaderboardPage />);

    expect(screen.getByText(/загружаем|loading/i)).toBeInTheDocument();
  });
});

import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRaceTime } from '@/shared/lib';
import { mockQueryResult } from '@/test/mock-query-result';
import { renderWithRouter } from '@/test/render';

vi.mock('@/features/auth', () => ({
  useAuthUser: vi.fn(),
  useAuthHydrated: vi.fn(() => true),
  useGetMeQuery: vi.fn(),
}));

import { useAuthUser, useGetMeQuery } from '@/features/auth';
import { ProfilePage } from './profile-page';

const mockedUseAuthUser = vi.mocked(useAuthUser);
const mockedUseGetMeQuery = vi.mocked(useGetMeQuery);

type TMeQuery = ReturnType<typeof useGetMeQuery>;

describe('ProfilePage', () => {
  beforeEach(() => {
    localStorage.clear();
    mockedUseAuthUser.mockReset();
    mockedUseGetMeQuery.mockReset();
  });

  it('shows guest call to action', () => {
    mockedUseAuthUser.mockReturnValue(null);
    mockedUseGetMeQuery.mockReturnValue(
      mockQueryResult<TMeQuery>({
        data: undefined,
        isLoading: false,
        isError: false,
      }),
    );

    renderWithRouter(<ProfilePage />);

    expect(screen.getByText(/нужно войти|log in to see/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /вход|log in/i })).toHaveAttribute('href', '/login');
  });

  it('shows skeleton while profile loads', () => {
    mockedUseAuthUser.mockReturnValue({
      id: '1',
      nickname: 'racer_one',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    mockedUseGetMeQuery.mockReturnValue(
      mockQueryResult<TMeQuery>({
        data: undefined,
        isLoading: true,
        isError: false,
      }),
    );

    renderWithRouter(<ProfilePage />);

    expect(
      screen.getByRole('status', { name: /загружаем профиль|loading profile/i }),
    ).toBeInTheDocument();
  });

  it('shows nickname, stats, per-track bests and achievements', () => {
    mockedUseAuthUser.mockReturnValue({
      id: '1',
      nickname: 'racer_one',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    mockedUseGetMeQuery.mockReturnValue(
      mockQueryResult<TMeQuery>({
        data: {
          user: {
            id: '1',
            nickname: 'racer_one',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          bestResults: [],
          stats: {
            totalRaces: 5,
            tracksCompleted: 2,
            totalTimeMs: 333_340,
            firstRaceAt: '2024-01-01T00:00:00.000Z',
            lastRaceAt: '2024-01-05T00:00:00.000Z',
            perTrack: [
              {
                trackId: 't1',
                trackSlug: 'coastal-oval',
                trackName: 'Coastal Oval',
                races: 3,
                bestTimeMs: 65_340,
                totalTimeMs: 210_000,
                rank: 4,
                gapToLeaderMs: 5_000,
                improvementMs: 8_000,
              },
            ],
          },
        },
        isLoading: false,
        isError: false,
      }),
    );

    renderWithRouter(<ProfilePage />);

    expect(screen.getByText('racer_one')).toBeInTheDocument();
    expect(screen.getByText('Coastal Oval')).toBeInTheDocument();
    expect(screen.getByText(formatRaceTime(65_340))).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/#4/)).toBeInTheDocument();
    expect(screen.getByText(/Попыток: 3|3 attempts/i)).toBeInTheDocument();
    expect(screen.getByText(/Всего: 03:30\.00|Total: 03:30\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/\+5\.00s/)).toBeInTheDocument();
    expect(screen.getByText(/−8\.00s|-8\.00s/)).toBeInTheDocument();
    expect(screen.getByText(/Достижения|Achievements/i)).toBeInTheDocument();
    expect(screen.getByText(/Первый финиш|First finish/i)).toBeInTheDocument();
    expect(screen.getByText(/Марафонец|Marathoner/i)).toBeInTheDocument();
  });
});

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

  it('shows nickname and best times', () => {
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
          bestResults: [
            {
              trackId: 't1',
              trackSlug: 'coastal-oval',
              trackName: 'Coastal Oval',
              timeMs: 65_340,
              createdAt: '2024-01-01T00:00:00.000Z',
            },
          ],
        },
        isLoading: false,
        isError: false,
      }),
    );

    renderWithRouter(<ProfilePage />);

    expect(screen.getByText('racer_one')).toBeInTheDocument();
    expect(screen.getByText('Coastal Oval')).toBeInTheDocument();
    expect(screen.getByText(formatRaceTime(65_340))).toBeInTheDocument();
  });
});

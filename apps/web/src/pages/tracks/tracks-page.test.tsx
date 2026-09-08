import type * as trackEntity from '@/entities/track';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TRACK_SLUG_COASTAL_OVAL } from '@racing/shared';
import { mockQueryResult } from '@/test/mock-query-result';
import { renderWithRouter } from '@/test/render';

vi.mock('@/entities/track', async (importOriginal) => {
  const actual = await importOriginal<typeof trackEntity>();
  return {
    ...actual,
    useGetTracksQuery: vi.fn(),
  };
});

import { useGetTracksQuery } from '@/entities/track';
import { TracksPage } from './tracks-page';

const mockedUseGetTracksQuery = vi.mocked(useGetTracksQuery);

type TTracksQuery = ReturnType<typeof useGetTracksQuery>;

describe('TracksPage', () => {
  beforeEach(() => {
    mockedUseGetTracksQuery.mockReset();
  });

  it('shows loading state', () => {
    mockedUseGetTracksQuery.mockReturnValue(
      mockQueryResult<TTracksQuery>({
        data: undefined,
        isLoading: true,
        isError: false,
      }),
    );

    renderWithRouter(<TracksPage />);

    expect(screen.getByText(/загружаем|loading/i)).toBeInTheDocument();
  });

  it('lists available track with race link', () => {
    mockedUseGetTracksQuery.mockReturnValue(
      mockQueryResult<TTracksQuery>({
        data: [
          {
            id: 't1',
            slug: TRACK_SLUG_COASTAL_OVAL,
            name: 'Coastal Oval',
            isAvailable: true,
          },
        ],
        isLoading: false,
        isError: false,
      }),
    );

    renderWithRouter(<TracksPage />);

    expect(screen.getByText('Coastal Oval')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /старт|start/i })).toHaveAttribute(
      'href',
      `/race/${TRACK_SLUG_COASTAL_OVAL}`,
    );
  });
});

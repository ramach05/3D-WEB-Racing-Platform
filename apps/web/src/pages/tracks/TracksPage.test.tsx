import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TRACK_SLUG_COASTAL_OVAL } from '@racing/shared';
import { renderWithRouter } from '@/test/render';

vi.mock('@/entities/track', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/entities/track')>();
  return {
    ...actual,
    useGetTracksQuery: vi.fn(),
  };
});

import { useGetTracksQuery } from '@/entities/track';
import { TracksPage } from './TracksPage';

const mockedUseGetTracksQuery = vi.mocked(useGetTracksQuery);

describe('TracksPage', () => {
  beforeEach(() => {
    mockedUseGetTracksQuery.mockReset();
  });

  it('shows loading state', () => {
    mockedUseGetTracksQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useGetTracksQuery>);

    renderWithRouter(<TracksPage />);

    expect(screen.getByText(/загружаем|loading/i)).toBeInTheDocument();
  });

  it('lists available track with race link', () => {
    mockedUseGetTracksQuery.mockReturnValue({
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
    } as ReturnType<typeof useGetTracksQuery>);

    renderWithRouter(<TracksPage />);

    expect(screen.getByText('Coastal Oval')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /старт|start/i })).toHaveAttribute(
      'href',
      `/race/${TRACK_SLUG_COASTAL_OVAL}`,
    );
  });
});

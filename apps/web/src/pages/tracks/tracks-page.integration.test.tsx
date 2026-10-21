import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TRACK_SLUG_COASTAL_OVAL } from '@racing/shared';
import { getApiBaseUrl } from '@/shared/config';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/msw/server';
import { TracksPage } from './tracks-page';

const api = getApiBaseUrl();

describe('TracksPage integration', () => {
  it('lists tracks from api', async () => {
    renderWithProviders(<TracksPage />);

    expect(await screen.findByText('Coastal Oval')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /старт|start/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0]).toHaveAttribute('href', `/race/${TRACK_SLUG_COASTAL_OVAL}`);
  });

  it('shows error when tracks request fails', async () => {
    server.use(
      http.get(`${api}/tracks`, () => HttpResponse.json({ message: 'fail' }, { status: 500 })),
    );

    renderWithProviders(<TracksPage />);

    await waitFor(() => {
      expect(screen.getByText(/не удалось|failed|error/i)).toBeInTheDocument();
    });
  });
});

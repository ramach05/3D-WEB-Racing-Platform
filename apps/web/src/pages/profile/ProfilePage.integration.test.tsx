import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AUTH_STORAGE_KEY } from '@/shared/config';
import { formatRaceTime } from '@/shared/lib';
import { renderWithProviders } from '@/test/render';
import { ProfilePage } from './ProfilePage';

describe('ProfilePage integration', () => {
  it('loads nickname and best times from me endpoint', async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ accessToken: 'access-token', refreshToken: 'refresh-token' }),
    );

    renderWithProviders(<ProfilePage />);

    expect(await screen.findByText('racer_one')).toBeInTheDocument();
    expect(screen.getByText('Coastal Oval')).toBeInTheDocument();
    expect(screen.getByText(formatRaceTime(65_340))).toBeInTheDocument();
  });

  it('shows guest cta without session', async () => {
    renderWithProviders(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText(/нужно войти|log in to see/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /вход|log in/i })).toHaveAttribute('href', '/login');
  });
});

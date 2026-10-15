import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthHydrator } from '@/features/auth';
import { clearAuthSession, formatRaceTime, writeAuthSession } from '@/shared/lib';
import { renderWithProviders } from '@/test/render';
import { ProfilePage } from './profile-page';

const renderPageWithHydrator = () =>
  renderWithProviders(
    <>
      <AuthHydrator />
      <ProfilePage />
    </>,
  );

describe('ProfilePage integration', () => {
  beforeEach(() => {
    clearAuthSession();
  });

  it('loads nickname and best times from me endpoint', async () => {
    writeAuthSession({ accessToken: 'access-token' });

    renderPageWithHydrator();

    expect(await screen.findByText('racer_one')).toBeInTheDocument();
    expect(screen.getByText('Coastal Oval')).toBeInTheDocument();
    expect(screen.getByText(formatRaceTime(65_340))).toBeInTheDocument();
  });

  it('shows guest cta without session', async () => {
    renderPageWithHydrator();

    await waitFor(() => {
      expect(screen.getByText(/нужно войти|log in to see/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /вход|log in/i })).toHaveAttribute('href', '/login');
  });
});

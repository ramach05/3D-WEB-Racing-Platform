import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '@/test/render';
import { AppHeader } from './app-header';

vi.mock('@/features/auth', () => ({
  useAuthUser: vi.fn(),
  useAuthHydrated: vi.fn(() => true),
  useLogout: () => vi.fn(),
}));

import { useAuthHydrated, useAuthUser } from '@/features/auth';

const mockedUseAuthUser = vi.mocked(useAuthUser);
const mockedUseAuthHydrated = vi.mocked(useAuthHydrated);

describe('AppHeader', () => {
  it('exposes navigation landmark and settings group with switchers', () => {
    mockedUseAuthUser.mockReturnValue(null);
    renderWithRouter(<AppHeader />);

    const nav = screen.getByRole('navigation', { name: /навигация|navigation/i });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /главная|home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /трассы|tracks/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /гараж|garage/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /вход|log in/i })).toBeInTheDocument();

    expect(screen.getByRole('group', { name: /настройки|settings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /тема|theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /язык|language/i })).toBeInTheDocument();
  });

  it('shows skeleton instead of login link while session is hydrating', () => {
    mockedUseAuthUser.mockReturnValue(null);
    mockedUseAuthHydrated.mockReturnValue(false);
    renderWithRouter(<AppHeader />);

    expect(screen.queryByRole('link', { name: /вход|log in/i })).not.toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: /загрузка сессии|loading session/i }),
    ).toBeInTheDocument();
  });
});

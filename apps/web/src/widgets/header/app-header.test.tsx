import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '@/test/render';
import { AppHeader } from './app-header';

vi.mock('@/features/auth', () => ({
  useAuthUser: vi.fn(),
  useLogout: () => vi.fn(),
}));

import { useAuthUser } from '@/features/auth';

const mockedUseAuthUser = vi.mocked(useAuthUser);

describe('AppHeader', () => {
  it('truncates long nickname visually but keeps full value in title', () => {
    const nickname = 'a'.repeat(20);
    mockedUseAuthUser.mockReturnValue({
      id: '1',
      nickname,
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    renderWithRouter(<AppHeader />);

    const label = screen.getByText(nickname);
    expect(label).toHaveAttribute('title', nickname);
    expect(label.className).toContain('truncate');
  });

  it('exposes navigation landmark and settings group with switchers', () => {
    mockedUseAuthUser.mockReturnValue(null);
    renderWithRouter(<AppHeader />);

    const nav = screen.getByRole('navigation', { name: /навигация|navigation/i });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /главная|home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /трассы|tracks/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /вход|log in/i })).toBeInTheDocument();

    expect(screen.getByRole('group', { name: /настройки|settings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /тема|theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /язык|language/i })).toBeInTheDocument();
  });
});

import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '@/test/render';
import { HomePage } from './home-page';

vi.mock('@/features/auth', () => ({
  useAuthUser: vi.fn(),
  useAuthHydrated: vi.fn(() => true),
}));

import { useAuthUser } from '@/features/auth';

const mockedUseAuthUser = vi.mocked(useAuthUser);

describe('HomePage', () => {
  it('hides login and register for authenticated users', () => {
    mockedUseAuthUser.mockReturnValue({
      id: '1',
      nickname: 'test_user',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    renderWithRouter(<HomePage />);

    expect(screen.queryByRole('link', { name: /вход|log in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /регистрация|sign up/i })).not.toBeInTheDocument();
    // RU-locale CTA text is latin "START", EN is "PRESS START"
    expect(screen.getByRole('link', { name: /старт|start/i })).toBeInTheDocument();
  });

  it('shows auth links for guests', () => {
    mockedUseAuthUser.mockReturnValue(null);
    renderWithRouter(<HomePage />);

    expect(screen.getByRole('link', { name: /вход|log in/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /регистрация|sign up/i })).toBeInTheDocument();
  });

  it('renders featured track cards as links to /tracks', () => {
    mockedUseAuthUser.mockReturnValue(null);
    renderWithRouter(<HomePage />);

    const trackLinks = screen.getAllByRole('link', { name: /coastal oval|night city/i });
    expect(trackLinks).toHaveLength(2);
    for (const link of trackLinks) {
      expect(link).toHaveAttribute('href', '/tracks');
    }
  });
});

import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '@/test/render';
import { AppHeader } from './AppHeader';

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
});

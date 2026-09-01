import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LeaderboardEntry } from '@racing/shared';
import { LeaderboardTable } from './LeaderboardTable';

describe('LeaderboardTable', () => {
  it('renders ranks and racer names from mocked entries', () => {
    const entries: LeaderboardEntry[] = [
      {
        rank: 1,
        userId: 'u1',
        nickname: 'test_user',
        timeMs: 40_120,
        createdAt: '2026-01-01T12:00:00.000Z',
      },
    ];

    render(<LeaderboardTable entries={entries} />);

    expect(screen.getByRole('columnheader', { name: /место|rank/i })).toBeInTheDocument();
    expect(screen.getByText('test_user')).toBeInTheDocument();
    expect(screen.getByText('00:40.12')).toBeInTheDocument();
  });
});

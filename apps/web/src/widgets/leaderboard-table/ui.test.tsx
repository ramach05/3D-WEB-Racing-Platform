import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TLeaderboardEntry } from '@racing/shared';
import { LeaderboardTable } from './leaderboard-table';

describe('LeaderboardTable', () => {
  it('renders ranks and racer names from mocked entries', () => {
    const entries: TLeaderboardEntry[] = [
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

  it('exposes the horizontal scroll container to the keyboard', () => {
    const entries: TLeaderboardEntry[] = [
      {
        rank: 1,
        userId: 'u1',
        nickname: 'test_user',
        timeMs: 40_120,
        createdAt: '2026-01-01T12:00:00.000Z',
      },
    ];

    render(<LeaderboardTable entries={entries} />);

    const region = screen.getByRole('region', { name: /прокручиваем|scrollable/i });
    expect(region).toHaveAttribute('tabindex', '0');
  });

  it('compact variant fits the container: no date column, no min-width, no scroll region', () => {
    const entries: TLeaderboardEntry[] = [
      {
        rank: 1,
        userId: 'u1',
        nickname: 'test_user',
        timeMs: 40_120,
        createdAt: '2026-01-01T12:00:00.000Z',
      },
    ];

    render(<LeaderboardTable entries={entries} variant="compact" />);

    expect(screen.queryByRole('columnheader', { name: /дата|date/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(table.className).not.toContain('min-w');
    expect(table.className).toContain('table-auto');
  });

  it('highlights the current user nickname', () => {
    const entries: TLeaderboardEntry[] = [
      {
        rank: 1,
        userId: 'u1',
        nickname: 'rival',
        timeMs: 39_000,
        createdAt: '2026-01-01T12:00:00.000Z',
      },
      {
        rank: 2,
        userId: 'me',
        nickname: 'current_user',
        timeMs: 41_000,
        createdAt: '2026-01-01T12:00:00.000Z',
      },
    ];

    render(<LeaderboardTable entries={entries} highlightUserId="me" />);

    const mine = screen.getByText('current_user');
    const rival = screen.getByText('rival');
    expect(mine.className).toContain('text-[var(--sega-yellow)]');
    expect(mine.className).toContain('font-semibold');
    expect(rival.className).toContain('text-[var(--sega-magenta)]');
    expect(rival.className).not.toContain('font-semibold');
  });
});

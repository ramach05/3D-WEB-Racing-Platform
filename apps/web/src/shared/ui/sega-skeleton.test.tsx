import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  LeaderboardTableSkeleton,
  LeaderboardTabsSkeleton,
  ProfilePageSkeleton,
  SegaSkeleton,
  TracksPageSkeleton,
} from './sega-skeleton';

describe('SegaSkeleton', () => {
  it('renders hidden placeholder block', () => {
    const { container } = render(<SegaSkeleton className="h-4 w-20" />);

    const block = container.querySelector('.sega-skeleton');
    expect(block).toBeInTheDocument();
    expect(block).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('page skeletons', () => {
  it('TracksPageSkeleton exposes loading status', () => {
    render(<TracksPageSkeleton />);

    expect(screen.getByRole('status', { name: /загружаем трассы|loading tracks/i })).toBeInTheDocument();
  });

  it('LeaderboardTabsSkeleton exposes tracks loading status', () => {
    render(<LeaderboardTabsSkeleton />);

    expect(screen.getByRole('status', { name: /загружаем трассы|loading tracks/i })).toBeInTheDocument();
  });

  it('LeaderboardTableSkeleton exposes leaderboard loading status', () => {
    render(<LeaderboardTableSkeleton />);

    expect(screen.getByRole('status', { name: /загружаем таблицу|loading leaderboard/i })).toBeInTheDocument();
  });

  it('ProfilePageSkeleton exposes profile loading status', () => {
    render(<ProfilePageSkeleton />);

    expect(screen.getByRole('status', { name: /загружаем профиль|loading profile/i })).toBeInTheDocument();
  });
});

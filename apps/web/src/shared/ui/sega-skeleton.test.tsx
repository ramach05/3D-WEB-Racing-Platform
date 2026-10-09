import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TRACK_SLUGS } from '@racing/shared';
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
    const { container } = render(<TracksPageSkeleton />);

    expect(screen.getByRole('status', { name: /загружаем трассы|loading tracks/i })).toBeInTheDocument();
    expect(container.querySelectorAll('.sega-panel')).toHaveLength(TRACK_SLUGS.length);
    // layout совпадает с реальным списком TracksPage (в т.ч. lg-колонки в ряд)
    expect(container.querySelector('ul')).toHaveClass('lg:grid-flow-col', 'lg:auto-cols-fr');
  });

  it('TracksPageSkeleton honors count prop', () => {
    const { container } = render(<TracksPageSkeleton count={1} />);

    expect(container.querySelectorAll('.sega-panel')).toHaveLength(1);
  });

  it('LeaderboardTabsSkeleton exposes tracks loading status', () => {
    const { container } = render(<LeaderboardTabsSkeleton />);

    expect(screen.getByRole('status', { name: /загружаем трассы|loading tracks/i })).toBeInTheDocument();
    expect(container.querySelectorAll('.sega-track-tab')).toHaveLength(TRACK_SLUGS.length);
  });

  it('LeaderboardTabsSkeleton honors count prop', () => {
    const { container } = render(<LeaderboardTabsSkeleton count={1} />);

    expect(container.querySelectorAll('.sega-track-tab')).toHaveLength(1);
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

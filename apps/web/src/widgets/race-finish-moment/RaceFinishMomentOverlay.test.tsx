import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { finishRaceForTest, resetRaceSession } from '@/features/race-session';
import { formatRaceTime } from '@/shared/lib';
import { RaceFinishMomentOverlay } from './RaceFinishMomentOverlay';

describe('RaceFinishMomentOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetRaceSession('finish-moment', 4, 3);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRaceSession('finish-moment', 4, 3);
  });

  it('renders nothing when inactive', () => {
    const { container } = render(
      <RaceFinishMomentOverlay active={false} timeMs={12_000} isNewBest={false} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows finish then time', () => {
    finishRaceForTest('finish-moment', 65_340);
    render(<RaceFinishMomentOverlay active timeMs={65_340} isNewBest />);

    expect(screen.getByRole('status')).toHaveTextContent(/финиш|finish/i);

    act(() => {
      vi.advanceTimersByTime(1800);
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      new RegExp(formatRaceTime(65_340).replace('.', '\\.')),
    );
    expect(screen.getByText(/новый рекорд|new best/i)).toBeInTheDocument();
  });
});

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginCountdown,
  getRaceHudSnapshot,
  resetRaceSession,
} from '@/features/race-session';
import { RaceCountdownOverlay } from './RaceCountdownOverlay';

describe('RaceCountdownOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetRaceSession('countdown-test', 4, 3);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRaceSession('countdown-test', 4, 3);
  });

  it('renders nothing outside countdown', () => {
    const { container } = render(<RaceCountdownOverlay />);

    expect(container).toBeEmptyDOMElement();
  });

  it('runs 3-2-1-GO then starts racing', () => {
    beginCountdown();
    render(<RaceCountdownOverlay />);

    expect(screen.getByRole('status')).toHaveTextContent('3');

    act(() => {
      vi.advanceTimersByTime(750);
    });
    expect(screen.getByRole('status')).toHaveTextContent('2');

    act(() => {
      vi.advanceTimersByTime(750);
    });
    expect(screen.getByRole('status')).toHaveTextContent('1');

    act(() => {
      vi.advanceTimersByTime(750);
    });
    expect(screen.getByRole('status')).toHaveTextContent(/GO!/i);

    act(() => {
      vi.advanceTimersByTime(550);
    });

    expect(getRaceHudSnapshot().status).toBe('racing');
  });
});

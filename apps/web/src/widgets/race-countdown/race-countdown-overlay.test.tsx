import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginCountdown,
  getRaceHudSnapshot,
  resetRaceSession,
} from '@/features/race-session';
import { RaceCountdownOverlay } from './race-countdown-overlay';

describe('RaceCountdownOverlay', () => {
  beforeEach(() => {
    // Уведомления HUD в сторе отложены на ближайший rAF — таймер его не догонит.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });
    resetRaceSession('countdown-test', 4, 3);
  });

  afterEach(() => {
    resetRaceSession('countdown-test', 4, 3);
    // Догоняем отложенный flush, чтобы флаг уведомления не «залип» на снятых фейковых таймерах.
    act(() => {
      vi.advanceTimersByTime(100);
    });
    vi.useRealTimers();
  });

  it('renders nothing outside countdown', () => {
    const { container } = render(<RaceCountdownOverlay />);

    expect(container).toBeEmptyDOMElement();
  });

  // Шаг таймера + ближайший rAF, в котором стор уведомляет подписчиков.
  const advance = (ms: number) => {
    act(() => {
      vi.advanceTimersByTime(ms + 32);
    });
  };

  it('runs 3-2-1-GO then starts racing', () => {
    beginCountdown();
    render(<RaceCountdownOverlay />);

    expect(screen.getByRole('status')).toHaveTextContent('3');

    advance(750);
    expect(screen.getByRole('status')).toHaveTextContent('2');

    advance(750);
    expect(screen.getByRole('status')).toHaveTextContent('1');

    advance(750);
    expect(screen.getByRole('status')).toHaveTextContent(/GO!/i);

    advance(550);

    expect(getRaceHudSnapshot().status).toBe('racing');
  });
});

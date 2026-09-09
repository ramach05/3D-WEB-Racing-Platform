import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearTouchAxes, getDriveInput } from '@/features/race-session';
import { RaceTouchControls } from './race-touch-controls';

describe('RaceTouchControls', () => {
  afterEach(() => {
    clearTouchAxes();
  });

  it('renders steer, throttle, brake, pause and restart buttons', () => {
    render(<RaceTouchControls onRestart={vi.fn()} onTogglePause={vi.fn()} />);

    expect(screen.getByRole('button', { name: /газ|throttle/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /тормоз|brake/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /влево|steer left/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /вправо|steer right/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /пауза|pause/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /рестарт|restart/i })).toBeInTheDocument();
  });

  it('sets throttle on pointerdown and clears on pointerup', () => {
    render(<RaceTouchControls onRestart={vi.fn()} onTogglePause={vi.fn()} />);
    const throttle = screen.getByRole('button', { name: /газ|throttle/i });

    fireEvent.pointerDown(throttle);
    expect(getDriveInput().throttle).toBe(1);

    fireEvent.pointerUp(throttle);
    expect(getDriveInput().throttle).toBe(0);
  });

  it('calls pause and restart handlers', () => {
    const onRestart = vi.fn();
    const onTogglePause = vi.fn();
    render(<RaceTouchControls onRestart={onRestart} onTogglePause={onTogglePause} />);

    fireEvent.click(screen.getByRole('button', { name: /пауза|pause/i }));
    fireEvent.click(screen.getByRole('button', { name: /рестарт|restart/i }));

    expect(onTogglePause).toHaveBeenCalledTimes(1);
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('renders optional footer under the pad', () => {
    render(
      <RaceTouchControls
        onRestart={vi.fn()}
        onTogglePause={vi.fn()}
        footer="Guest hint"
      />,
    );

    expect(screen.getByText('Guest hint')).toBeInTheDocument();
  });
});

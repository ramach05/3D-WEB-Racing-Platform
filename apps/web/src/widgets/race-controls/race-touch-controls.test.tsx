import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearTouchAxes, getDriveInput } from '@/features/race-session';
import { RaceTouchControls } from './race-touch-controls';

describe('RaceTouchControls', () => {
  afterEach(() => {
    clearTouchAxes();
  });

  it('renders steer, throttle, brake, handbrake, pause, restart and camera buttons', () => {
    render(
      <RaceTouchControls onRestart={vi.fn()} onTogglePause={vi.fn()} onCycleCamera={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /газ|throttle/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^(тормоз|brake)$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ручник|handbrake/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /влево|steer left/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /вправо|steer right/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /пауза|pause/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /рестарт|restart/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /камера|camera/i })).toBeInTheDocument();
  });

  it('sets throttle on pointerdown and clears on pointerup', () => {
    render(
      <RaceTouchControls onRestart={vi.fn()} onTogglePause={vi.fn()} onCycleCamera={vi.fn()} />,
    );
    const throttle = screen.getByRole('button', { name: /газ|throttle/i });

    fireEvent.pointerDown(throttle);
    expect(getDriveInput().throttle).toBe(1);

    fireEvent.pointerUp(throttle);
    expect(getDriveInput().throttle).toBe(0);
  });

  it('sets handbrake on pointerdown and clears on pointerup', () => {
    render(
      <RaceTouchControls onRestart={vi.fn()} onTogglePause={vi.fn()} onCycleCamera={vi.fn()} />,
    );
    const handbrake = screen.getByRole('button', { name: /ручник|handbrake/i });

    fireEvent.pointerDown(handbrake);
    expect(getDriveInput().handbrake).toBe(1);

    fireEvent.pointerUp(handbrake);
    expect(getDriveInput().handbrake).toBe(0);
  });

  it('calls pause, restart and camera handlers', () => {
    const onRestart = vi.fn();
    const onTogglePause = vi.fn();
    const onCycleCamera = vi.fn();
    render(
      <RaceTouchControls
        onRestart={onRestart}
        onTogglePause={onTogglePause}
        onCycleCamera={onCycleCamera}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /пауза|pause/i }));
    fireEvent.click(screen.getByRole('button', { name: /рестарт|restart/i }));
    fireEvent.click(screen.getByRole('button', { name: /камера|camera/i }));

    expect(onTogglePause).toHaveBeenCalledTimes(1);
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(onCycleCamera).toHaveBeenCalledTimes(1);
  });

  it('renders optional footer under the pad', () => {
    render(
      <RaceTouchControls
        onRestart={vi.fn()}
        onTogglePause={vi.fn()}
        onCycleCamera={vi.fn()}
        footer="Guest hint"
      />,
    );

    expect(screen.getByText('Guest hint')).toBeInTheDocument();
  });

  it('hides the mute button when onToggleMute is not passed', () => {
    render(
      <RaceTouchControls onRestart={vi.fn()} onTogglePause={vi.fn()} onCycleCamera={vi.fn()} />,
    );

    expect(screen.queryByRole('button', { name: /музыку?|music/i })).not.toBeInTheDocument();
  });

  it('renders the mute button in the action bar and calls onToggleMute', () => {
    const onToggleMute = vi.fn();
    const { rerender } = render(
      <RaceTouchControls
        onRestart={vi.fn()}
        onTogglePause={vi.fn()}
        onCycleCamera={vi.fn()}
        muted={false}
        onToggleMute={onToggleMute}
      />,
    );

    const mute = screen.getByRole('button', { name: /музыку?|music/i });
    expect(mute).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(mute);
    expect(onToggleMute).toHaveBeenCalledTimes(1);

    rerender(
      <RaceTouchControls
        onRestart={vi.fn()}
        onTogglePause={vi.fn()}
        onCycleCamera={vi.fn()}
        muted
        onToggleMute={onToggleMute}
      />,
    );
    expect(screen.getByRole('button', { name: /музыку?|music/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { formatRaceTime } from '@/shared/lib';
import { RaceFinishOverlay } from './race-finish-overlay';

describe('RaceFinishOverlay', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <RaceFinishOverlay
        open={false}
        trackName="Coastal Oval"
        timeMs={12_340}
        bestMs={null}
        isNewBest={false}
        isGuest
        submitState="idle"
        onRestart={() => undefined}
        onExit={() => undefined}
        onOpenLeaderboard={() => undefined}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows time, guest hint and actions', async () => {
    const user = userEvent.setup();
    const onRestart = vi.fn();
    const onExit = vi.fn();

    render(
      <RaceFinishOverlay
        open
        trackName="Coastal Oval"
        timeMs={65_340}
        bestMs={70_000}
        isNewBest
        isGuest
        submitState="idle"
        onRestart={onRestart}
        onExit={onExit}
        onOpenLeaderboard={() => undefined}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Coastal Oval')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(formatRaceTime(65_340)))).toBeInTheDocument();
    expect(screen.getByText(/новый рекорд|new best/i)).toBeInTheDocument();
    expect(screen.getByText(/войдите|log in/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /лидерборд|leaderboard/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /рестарт|restart/i }));
    await user.click(screen.getByRole('button', { name: /к трассам|to tracks/i }));

    expect(onRestart).toHaveBeenCalledOnce();
    expect(onExit).toHaveBeenCalledOnce();
  });
});

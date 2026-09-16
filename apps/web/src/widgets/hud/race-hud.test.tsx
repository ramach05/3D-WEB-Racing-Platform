import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { formatRaceTime } from '@/shared/lib';
import { resetRaceSession, startRacing } from '@/features/race-session';
import { RaceHud } from './race-hud';

const TRACK_NAME = 'Coastal Oval';

describe('RaceHud', () => {
  afterEach(() => {
    resetRaceSession('hud-test', 4, 3);
  });

  it('shows track name first, ready status and lap counter', () => {
    resetRaceSession('hud-test', 4, 3);

    render(<RaceHud trackName={TRACK_NAME} />);

    expect(screen.getByText(/трасса|track/i)).toBeInTheDocument();
    expect(screen.getByText(TRACK_NAME)).toBeInTheDocument();
    expect(screen.getByText(/на старт|on your marks/i)).toBeInTheDocument();
    expect(screen.getByText(/скорость|speed/i)).toBeInTheDocument();
    expect(screen.getByText(/круг|lap/i)).toBeInTheDocument();
    expect(screen.getByText('0/3')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(formatRaceTime(0).replace('.', '\\.')))).toBeInTheDocument();
    expect(screen.getByText(/лучшее|best/i)).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows leaderboard track record as best time', () => {
    resetRaceSession('hud-test', 4, 3);

    render(<RaceHud trackName={TRACK_NAME} bestMs={27_450} />);

    expect(screen.getByText(formatRaceTime(27_450))).toBeInTheDocument();
  });

  it('shows racing status after start without joining track name', () => {
    resetRaceSession('hud-test', 4, 3);
    startRacing();

    render(<RaceHud trackName={TRACK_NAME} />);

    expect(screen.getByText(/заезд|racing/i)).toBeInTheDocument();
    expect(screen.getByText(TRACK_NAME)).toBeInTheDocument();
    expect(
      screen.queryByText(new RegExp(`(заезд|racing).+${TRACK_NAME}`, 'i')),
    ).not.toBeInTheDocument();
  });
});

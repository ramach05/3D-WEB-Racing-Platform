import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { formatRaceTime } from '@/shared/lib';
import { resetRaceSession, startRacing } from '@/features/race-session';
import { RaceHud } from './RaceHud';

describe('RaceHud', () => {
  afterEach(() => {
    resetRaceSession('hud-test', 4, 3);
  });

  it('shows ready status and lap counter', () => {
    resetRaceSession('hud-test', 4, 3);

    render(<RaceHud />);

    expect(screen.getByText(/на старт|on your marks/i)).toBeInTheDocument();
    expect(screen.getByText(/0\/3/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(formatRaceTime(0).replace('.', '\\.')))).toBeInTheDocument();
  });

  it('shows racing status after start', () => {
    resetRaceSession('hud-test', 4, 3);
    startRacing();

    render(<RaceHud />);

    expect(screen.getByText(/заезд|racing/i)).toBeInTheDocument();
  });
});

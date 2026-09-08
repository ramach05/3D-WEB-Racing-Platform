import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/race-perf', () => ({
  useRacePerf: vi.fn(() => ({
    fps: 60,
    cpuPercent: 12,
    memMb: 128,
  })),
}));

import { RacePerfHud } from './race-perf-hud';

describe('RacePerfHud', () => {
  it('shows fps cpu and memory', () => {
    render(<RacePerfHud />);

    expect(screen.getByText(/FPS: 60/)).toBeInTheDocument();
    expect(screen.getByText(/CPU: 12%/)).toBeInTheDocument();
    expect(screen.getByText(/MEM: 128 MB/)).toBeInTheDocument();
  });
});

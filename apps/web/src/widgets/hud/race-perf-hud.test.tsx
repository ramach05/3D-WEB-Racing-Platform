import { render } from '@testing-library/react';
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
    const { container } = render(<RacePerfHud />);
    const line = container.querySelector('p')?.textContent ?? '';

    expect(line).toContain('FPS: 60');
    expect(line).toContain('CPU: 12%');
    expect(line).toContain('MEM: 128 MB');
  });
});

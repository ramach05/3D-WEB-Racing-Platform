import { describe, expect, it } from 'vitest';
import { formatRaceTime } from './format';

describe('formatRaceTime', () => {
  it('formats a minute plus fraction as mm:ss.hs', () => {
    const ms = 65_340;

    const formatted = formatRaceTime(ms);

    expect(formatted).toBe('01:05.34');
  });

  it('clamps negative values to zero', () => {
    const ms = -20;

    const formatted = formatRaceTime(ms);

    expect(formatted).toBe('00:00.00');
  });
});

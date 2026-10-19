import { describe, expect, it } from 'vitest';
import { formatGap, formatRaceTime } from './format';

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

describe('formatGap', () => {
  it('formats milliseconds as seconds with two decimals', () => {
    expect(formatGap(2_450)).toBe('2.45s');
  });

  it('clamps negative values to zero', () => {
    expect(formatGap(-100)).toBe('0.00s');
  });
});

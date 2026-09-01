import { describe, expect, it } from 'vitest';
import { formatRaceTime } from './format';

describe('formatRaceTime', () => {
  it('formats a minute plus fraction as mm:ss.hs', () => {
    // Arrange
    const ms = 65_340;

    // Act
    const formatted = formatRaceTime(ms);

    // Assert
    expect(formatted).toBe('01:05.34');
  });

  it('clamps negative values to zero', () => {
    // Arrange
    const ms = -20;

    // Act
    const formatted = formatRaceTime(ms);

    // Assert
    expect(formatted).toBe('00:00.00');
  });
});

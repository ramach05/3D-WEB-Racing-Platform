import { describe, expect, it } from 'vitest';
import {
  CENTERLINE_TO_RACE_YAW_OFFSET,
  isRaceLapCooldownCleared,
  yawAlongCenterline,
  yawFacingRaceDirection,
} from './race-direction';

describe('race-direction', () => {
  it('faces opposite to centerline tangent', () => {
    const dx = 1;
    const dz = 0;
    expect(yawFacingRaceDirection(dx, dz)).toBe(
      yawAlongCenterline(dx, dz) + CENTERLINE_TO_RACE_YAW_OFFSET,
    );
    expect(Math.abs(yawFacingRaceDirection(dx, dz) - yawAlongCenterline(dx, dz))).toBeCloseTo(
      Math.PI,
      10,
    );
  });

  it('clears lap cooldown only after leaving the finish along race direction', () => {
    expect(isRaceLapCooldownCleared(0.99, 0.14)).toBe(false);
    expect(isRaceLapCooldownCleared(0.85, 0.14)).toBe(true);
    expect(isRaceLapCooldownCleared(0.02, 0.14)).toBe(true);
  });
});

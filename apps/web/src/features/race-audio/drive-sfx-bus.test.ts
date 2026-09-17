import { describe, expect, it } from 'vitest';
import {
  IDLE_DRIVE_SFX_SAMPLE,
  getDriveSfxSample,
  resetDriveSfx,
  tickDriveSfxSample,
} from './drive-sfx-bus';

describe('drive-sfx-bus', () => {
  it('exposes surface fields on idle sample', () => {
    resetDriveSfx();
    expect(IDLE_DRIVE_SFX_SAMPLE.offRoadStrength).toBe(0);
    expect(IDLE_DRIVE_SFX_SAMPLE.kerbRumble).toBe(0);
  });

  it('stores the latest sample snapshot', () => {
    resetDriveSfx();
    tickDriveSfxSample({
      ...IDLE_DRIVE_SFX_SAMPLE,
      active: true,
      offRoadStrength: 0.4,
      kerbRumble: 0.2,
    });
    const sample = getDriveSfxSample();
    expect(sample.offRoadStrength).toBe(0.4);
    expect(sample.kerbRumble).toBe(0.2);
    resetDriveSfx();
  });
});

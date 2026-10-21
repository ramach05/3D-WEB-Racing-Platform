import { describe, expect, it } from 'vitest';
import { VEHICLE_MAX_SPEED } from '@/features/race-session';
import {
  CAMERA_FOV_BASE,
  CAMERA_FOV_CLOSE,
  CAMERA_FOV_MAX,
  mapModeSpeedToFov,
  mapSpeedToFov,
} from './camera-fov';

describe('mapSpeedToFov', () => {
  it('returns base FOV at zero or negative speed', () => {
    expect(mapSpeedToFov(0)).toBe(CAMERA_FOV_BASE);
    expect(mapSpeedToFov(-5)).toBe(CAMERA_FOV_BASE);
  });

  it('returns max FOV at VEHICLE_MAX_SPEED and above', () => {
    expect(mapSpeedToFov(VEHICLE_MAX_SPEED)).toBe(CAMERA_FOV_MAX);
    expect(mapSpeedToFov(VEHICLE_MAX_SPEED + 10)).toBe(CAMERA_FOV_MAX);
  });

  it('lerps mid speed', () => {
    const mid = mapSpeedToFov(VEHICLE_MAX_SPEED * 0.5);
    expect(mid).toBeCloseTo((CAMERA_FOV_BASE + CAMERA_FOV_MAX) / 2, 5);
  });
});

describe('mapModeSpeedToFov', () => {
  it('keeps bumper at fixed FOV regardless of speed', () => {
    expect(mapModeSpeedToFov('bumper', 0)).toBe(CAMERA_FOV_CLOSE);
    expect(mapModeSpeedToFov('bumper', VEHICLE_MAX_SPEED)).toBe(CAMERA_FOV_CLOSE);
  });

  it('uses speed FOV for chase and tv', () => {
    expect(mapModeSpeedToFov('chase', VEHICLE_MAX_SPEED)).toBe(CAMERA_FOV_MAX);
    expect(mapModeSpeedToFov('tv', 0)).toBe(CAMERA_FOV_BASE);
  });
});

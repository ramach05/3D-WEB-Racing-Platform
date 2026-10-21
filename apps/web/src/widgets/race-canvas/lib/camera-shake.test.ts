import { afterEach, describe, expect, it } from 'vitest';
import {
  CAMERA_SHAKE_CONTINUOUS_AMP,
  getCameraShakeImpulse,
  mapContinuousShake,
  pulseCameraShake,
  resetCameraShake,
  tickCameraShake,
} from './camera-shake';

describe('camera-shake', () => {
  afterEach(() => {
    resetCameraShake();
  });

  it('clamps pulse to 0…1 and keeps max pending', () => {
    pulseCameraShake(0.4);
    pulseCameraShake(0.2);
    expect(getCameraShakeImpulse()).toBe(0.4);
    pulseCameraShake(1.5);
    expect(getCameraShakeImpulse()).toBe(1);
    pulseCameraShake(-1);
    expect(getCameraShakeImpulse()).toBe(1);
  });

  it('decays impulse over time', () => {
    pulseCameraShake(1);
    const after = tickCameraShake(0.05, 0);
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(1);
    expect(getCameraShakeImpulse()).toBeLessThan(1);
  });

  it('adds continuous contribution scaled by amp', () => {
    const strength = tickCameraShake(0, 1);
    expect(strength).toBeCloseTo(CAMERA_SHAKE_CONTINUOUS_AMP, 5);
  });

  it('mapContinuousShake picks max of oil, half skid, 0.35 scrape', () => {
    expect(mapContinuousShake(0.8, 0.2, 0.1)).toBe(0.8);
    expect(mapContinuousShake(0.1, 1, 0.1)).toBe(0.5);
    expect(mapContinuousShake(0.1, 0.1, 1)).toBeCloseTo(0.35, 5);
  });
});

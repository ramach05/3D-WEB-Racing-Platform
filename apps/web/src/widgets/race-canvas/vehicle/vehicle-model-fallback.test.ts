import { describe, expect, it } from 'vitest';
import { uiPalette } from '@/shared/config';
import { VEHICLE_TARGET_LENGTH } from './vehicle-fit';
import {
  FALLBACK_ACCENT_CYAN,
  FALLBACK_ACCENT_MAGENTA,
  FALLBACK_BODY,
  FALLBACK_CABIN,
  FALLBACK_WHEEL,
  FALLBACK_WHEEL_POSITIONS,
} from './vehicle-model-fallback';

describe('VehicleModelFallback layout', () => {
  it('keeps body footprint tied to VEHICLE_TARGET_LENGTH', () => {
    expect(FALLBACK_BODY.width).toBeCloseTo(VEHICLE_TARGET_LENGTH * 0.48, 5);
    expect(FALLBACK_BODY.length).toBeCloseTo(VEHICLE_TARGET_LENGTH * 0.88, 5);
    expect(FALLBACK_BODY.height).toBeGreaterThan(0);
    expect(FALLBACK_BODY.y).toBeGreaterThan(FALLBACK_WHEEL.radius);
  });

  it('places cabin above the body', () => {
    expect(FALLBACK_CABIN.y).toBeGreaterThan(FALLBACK_BODY.y);
    expect(FALLBACK_CABIN.width).toBeLessThan(FALLBACK_BODY.width);
    expect(FALLBACK_CABIN.length).toBeLessThan(FALLBACK_BODY.length);
  });

  it('lays out four wheels on track and wheelbase', () => {
    expect(FALLBACK_WHEEL_POSITIONS).toHaveLength(4);
    for (const [x, y, z] of FALLBACK_WHEEL_POSITIONS) {
      expect(Math.abs(x)).toBeCloseTo(FALLBACK_WHEEL.track / 2, 5);
      expect(y).toBeCloseTo(FALLBACK_WHEEL.radius, 5);
      expect(Math.abs(z)).toBeCloseTo(FALLBACK_WHEEL.wheelbase / 2, 5);
    }
    expect(FALLBACK_WHEEL.track).toBeCloseTo(VEHICLE_TARGET_LENGTH * 0.42, 5);
    expect(FALLBACK_WHEEL.wheelbase).toBeCloseTo(VEHICLE_TARGET_LENGTH * 0.55, 5);
  });

  it('uses Sega dark accent tokens for wireframe colors', () => {
    expect(FALLBACK_ACCENT_CYAN).toBe(uiPalette.dark['sega-cyan']);
    expect(FALLBACK_ACCENT_MAGENTA).toBe(uiPalette.dark['sega-magenta']);
  });
});

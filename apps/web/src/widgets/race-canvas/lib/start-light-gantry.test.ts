import { describe, expect, it } from 'vitest';
import {
  FINISH_LAMP_BLINK_PERIOD_S,
  GANTRY_FLOOD,
  GANTRY_FLOOD_PLACEMENTS,
  GANTRY_FLOOD_SPOT,
  isFinishLampBlinkOn,
  isLampLit,
  litCountForHud,
  START_LAMP_BAY,
  START_LAMP_COUNT,
} from './start-light-gantry';

describe('START_LAMP_BAY', () => {
  it('keeps lens inside bezel and hood covering the bay', () => {
    expect(START_LAMP_BAY.lensRadius).toBeLessThan(START_LAMP_BAY.bezelOuterRadius);
    expect(START_LAMP_BAY.bezelOuterRadius).toBeLessThanOrEqual(START_LAMP_BAY.recessRadius);
    expect(START_LAMP_BAY.hood.width).toBeGreaterThan(START_LAMP_BAY.bezelOuterRadius * 2);
    expect(START_LAMP_BAY.idleEmissiveIntensity).toBeGreaterThan(0);
    expect(START_LAMP_BAY.litEmissiveIntensity).toBeGreaterThan(
      START_LAMP_BAY.idleEmissiveIntensity,
    );
  });
});

describe('gantry floodlights', () => {
  it('defines two stadium floods on spawn-side posts', () => {
    expect(GANTRY_FLOOD_PLACEMENTS).toHaveLength(2);
    const keys = GANTRY_FLOOD_PLACEMENTS.map(({ sideX, sideZ }) => `${sideX}:${sideZ}`);
    expect(new Set(keys).size).toBe(2);
    expect(GANTRY_FLOOD_PLACEMENTS.every(({ sideZ }) => sideZ === 1)).toBe(true);
    // Aim at the finish line (checker ≈ 0), not sideways along the track
    expect(Math.abs(GANTRY_FLOOD.aimZ)).toBeLessThan(0.5);
    expect(GANTRY_FLOOD.aimXFraction).toBeGreaterThan(0.1);
    expect(GANTRY_FLOOD.aimXFraction).toBeLessThan(0.4);
  });

  it('mounts floods to the post with plate, arm and yoke', () => {
    expect(GANTRY_FLOOD.mountPlate.depth).toBeGreaterThan(0);
    expect(GANTRY_FLOOD.arm.length).toBeGreaterThan(GANTRY_FLOOD.mountPlate.depth);
    expect(GANTRY_FLOOD.yoke.width).toBeGreaterThan(GANTRY_FLOOD.arm.radius * 2);
    expect(GANTRY_FLOOD.housing.depth).toBeGreaterThan(GANTRY_FLOOD.hood.depth);
    expect(GANTRY_FLOOD.mountDropY).toBeGreaterThan(0);
    // Group.lookAt → +Z toward the target; lens on the front face
    expect(GANTRY_FLOOD.lens.localZ).toBeGreaterThan(0);
    expect(GANTRY_FLOOD.lens.localZ).toBeGreaterThan(GANTRY_FLOOD.housing.depth / 2 - 0.02);
    expect(GANTRY_FLOOD.arm.length).toBeLessThan(0.2);
    expect(GANTRY_FLOOD.housing.width).toBeLessThan(0.16);
  });

  it('keeps road flood spot parameters aimed at the asphalt', () => {
    expect(GANTRY_FLOOD_SPOT.intensity).toBeGreaterThan(30);
    expect(GANTRY_FLOOD_SPOT.distance).toBeGreaterThan(12);
    expect(GANTRY_FLOOD_SPOT.angle).toBeGreaterThan(0.4);
    expect(GANTRY_FLOOD_SPOT.angle).toBeLessThan(0.9);
    expect(GANTRY_FLOOD_SPOT.penumbra).toBeGreaterThan(0.5);
  });
});

describe('litCountForHud', () => {
  it('maps countdown steps to progressive edge lamps', () => {
    expect(litCountForHud('countdown', 3)).toBe(2);
    expect(litCountForHud('countdown', 2)).toBe(4);
    expect(litCountForHud('countdown', 1)).toBe(5);
    expect(litCountForHud('countdown', 0)).toBe(0);
  });

  it('keeps lamps off outside countdown', () => {
    expect(litCountForHud('ready', 3)).toBe(0);
    expect(litCountForHud('racing', null)).toBe(0);
    expect(litCountForHud('finished', null)).toBe(0);
    expect(litCountForHud('paused', null)).toBe(0);
  });

  it('treats null countdown step as off', () => {
    expect(litCountForHud('countdown', null)).toBe(0);
  });
});

describe('isLampLit', () => {
  it('lights outer pairs first', () => {
    expect([0, 1, 2, 3, 4].map((i) => isLampLit(i, 2))).toEqual([true, false, false, false, true]);
    expect([0, 1, 2, 3, 4].map((i) => isLampLit(i, 4))).toEqual([true, true, false, true, true]);
  });

  it('lights all lamps when litCount covers the row', () => {
    expect([0, 1, 2, 3, 4].every((i) => isLampLit(i, START_LAMP_COUNT))).toBe(true);
  });

  it('lights none when litCount is zero', () => {
    expect([0, 1, 2, 3, 4].some((i) => isLampLit(i, 0))).toBe(false);
  });
});

describe('isFinishLampBlinkOn', () => {
  it('uses a 50% duty square wave over the finish blink period', () => {
    expect(isFinishLampBlinkOn(0)).toBe(true);
    expect(isFinishLampBlinkOn(FINISH_LAMP_BLINK_PERIOD_S / 2 - 0.001)).toBe(true);
    expect(isFinishLampBlinkOn(FINISH_LAMP_BLINK_PERIOD_S / 2)).toBe(false);
    expect(isFinishLampBlinkOn(FINISH_LAMP_BLINK_PERIOD_S - 0.001)).toBe(false);
  });

  it('repeats the period', () => {
    expect(isFinishLampBlinkOn(FINISH_LAMP_BLINK_PERIOD_S)).toBe(true);
    expect(isFinishLampBlinkOn(FINISH_LAMP_BLINK_PERIOD_S * 1.5)).toBe(false);
    expect(isFinishLampBlinkOn(FINISH_LAMP_BLINK_PERIOD_S * 2)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  GANTRY_FLOOD,
  GANTRY_FLOOD_PLACEMENTS,
  GANTRY_FLOOD_POINT,
  GANTRY_FLOOD_SPOT,
  isLampLit,
  litCountForHud,
  START_LAMP_COUNT,
} from './start-light-gantry';

describe('gantry floodlights', () => {
  it('defines four stadium flood placements around the line', () => {
    expect(GANTRY_FLOOD_PLACEMENTS).toHaveLength(4);
    const keys = GANTRY_FLOOD_PLACEMENTS.map(({ sideX, sideZ }) => `${sideX}:${sideZ}`);
    expect(new Set(keys).size).toBe(4);
    expect(GANTRY_FLOOD.aimZ).toBeGreaterThan(2);
    expect(GANTRY_FLOOD.aimXFraction).toBeGreaterThan(0.1);
    expect(GANTRY_FLOOD.aimXFraction).toBeLessThan(0.5);
  });

  it('keeps road flood spot and post spill parameters usable at night', () => {
    expect(GANTRY_FLOOD_SPOT.intensity).toBeGreaterThan(30);
    expect(GANTRY_FLOOD_SPOT.distance).toBeGreaterThan(12);
    expect(GANTRY_FLOOD_SPOT.angle).toBeGreaterThan(0.5);
    expect(GANTRY_FLOOD_SPOT.penumbra).toBeGreaterThan(0.7);
    expect(GANTRY_FLOOD_POINT.intensity).toBeGreaterThan(1);
    expect(GANTRY_FLOOD_POINT.distance).toBeGreaterThan(6);
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

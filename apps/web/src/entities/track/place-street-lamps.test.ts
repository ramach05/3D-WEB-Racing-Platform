import { describe, expect, it } from 'vitest';
import {
  coastalOvalTrack,
  isInsideCheckpoint,
  nightCityTrack,
  placeStreetLamps,
  STREET_LAMP_PLACEMENT,
} from './index';
import { expectedNightCityLampCount } from './place-street-lamps';
import type { TLoopPoint } from './config.types';

const distanceToCenterline = (x: number, z: number, centerline: TLoopPoint[]): number => {
  let best = Infinity;
  for (let i = 0; i < centerline.length; i += 1) {
    const a = centerline[i];
    const b = centerline[(i + 1) % centerline.length];
    if (!a || !b) {
      continue;
    }
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lenSq = dx * dx + dz * dz;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lenSq));
    const px = a.x + dx * t;
    const pz = a.z + dz * t;
    best = Math.min(best, Math.hypot(x - px, z - pz));
  }
  return best;
};

describe('placeStreetLamps', () => {
  it('places lamps on Coastal Oval (day track, lit separately at render)', () => {
    const lamps = placeStreetLamps({ config: coastalOvalTrack });
    expect(lamps.length).toBeGreaterThan(0);

    const wallBand =
      coastalOvalTrack.roadWidth / 2 +
      STREET_LAMP_PLACEMENT.wallThickness +
      STREET_LAMP_PLACEMENT.wallOutset;

    for (const lamp of lamps) {
      const dist = distanceToCenterline(lamp.x, lamp.z, coastalOvalTrack.centerline);
      expect(dist).toBeGreaterThan(wallBand - 0.5);
      expect(dist).toBeLessThan(wallBand + 0.5);
    }

    const line = coastalOvalTrack.startFinishLine;
    const minSq =
      STREET_LAMP_PLACEMENT.startFinishClearance * STREET_LAMP_PLACEMENT.startFinishClearance;
    for (const lamp of lamps) {
      const dx = lamp.x - line.position[0];
      const dz = lamp.z - line.position[2];
      expect(dx * dx + dz * dz).toBeGreaterThanOrEqual(minSq - 0.01);
    }
  });

  it('places staggered lamps on Night City (one per station, ~half of prior density)', () => {
    const lamps = placeStreetLamps({ config: nightCityTrack });
    const { min, max } = expectedNightCityLampCount(nightCityTrack);

    expect(lamps.length).toBeGreaterThanOrEqual(min);
    expect(lamps.length).toBeLessThanOrEqual(max);
    expect(lamps.length).toBeGreaterThan(2);

    const wallBand =
      nightCityTrack.roadWidth / 2 +
      STREET_LAMP_PLACEMENT.wallThickness +
      STREET_LAMP_PLACEMENT.wallOutset;

    for (const lamp of lamps) {
      const dist = distanceToCenterline(lamp.x, lamp.z, nightCityTrack.centerline);
      expect(dist).toBeGreaterThan(wallBand - 0.5);
      expect(dist).toBeLessThan(wallBand + 0.5);
    }
  });

  it('uses both outer and inner sides along the track', () => {
    const lamps = placeStreetLamps({ config: nightCityTrack });
    expect(lamps.length).toBeGreaterThan(2);

    const sides = new Set(lamps.map((lamp) => lamp.sideSign));
    expect(sides.has(1)).toBe(true);
    expect(sides.has(-1)).toBe(true);
  });

  it('never places lamps inside tribune exclusion zones', () => {
    const lamps = placeStreetLamps({ config: nightCityTrack });
    expect(nightCityTrack.treeExclusionZones.length).toBeGreaterThan(0);

    for (const lamp of lamps) {
      for (const zone of nightCityTrack.treeExclusionZones) {
        expect(isInsideCheckpoint(lamp.x, lamp.z, zone)).toBe(false);
      }
    }
  });

  it('keeps clearance from start/finish line', () => {
    const lamps = placeStreetLamps({ config: nightCityTrack });
    const line = nightCityTrack.startFinishLine;
    const minSq =
      STREET_LAMP_PLACEMENT.startFinishClearance * STREET_LAMP_PLACEMENT.startFinishClearance;

    for (const lamp of lamps) {
      const dx = lamp.x - line.position[0];
      const dz = lamp.z - line.position[2];
      expect(dx * dx + dz * dz).toBeGreaterThanOrEqual(minSq - 0.01);
    }
  });

  it('is deterministic for the same config', () => {
    const first = placeStreetLamps({ config: nightCityTrack });
    const second = placeStreetLamps({ config: nightCityTrack });
    expect(first).toEqual(second);
  });

  it('returns empty for empty centerline', () => {
    const empty = {
      ...nightCityTrack,
      centerline: [] as TLoopPoint[],
    };
    expect(placeStreetLamps({ config: empty })).toEqual([]);
  });
});

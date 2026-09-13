import { describe, expect, it } from 'vitest';
import {
  BILLBOARD_PLACEMENT,
  coastalOvalTrack,
  isInsideCheckpoint,
  nightCityTrack,
  placeBillboards,
  placeStreetLamps,
} from './index';
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

describe('placeBillboards', () => {
  it.each([
    ['coastal-oval', coastalOvalTrack],
    ['night-city', nightCityTrack],
  ] as const)('places %s billboards with exactly one for-rent', (_slug, config) => {
    const billboards = placeBillboards({ config });

    expect(billboards.length).toBe(BILLBOARD_PLACEMENT.defaultTargetCount);

    const forRent = billboards.filter((b) => b.adId === 'for-rent');
    expect(forRent).toHaveLength(1);

    const adIds = new Set(billboards.map((b) => b.adId));
    expect(adIds.size).toBe(billboards.length);
  });

  it.each([
    ['coastal-oval', coastalOvalTrack],
    ['night-city', nightCityTrack],
  ] as const)('keeps %s billboards outside the wall band', (_slug, config) => {
    const billboards = placeBillboards({ config });
    const wallBand =
      config.roadWidth / 2 + BILLBOARD_PLACEMENT.wallThickness + BILLBOARD_PLACEMENT.wallOutset;

    for (const billboard of billboards) {
      const dist = distanceToCenterline(billboard.x, billboard.z, config.centerline);
      expect(dist).toBeGreaterThan(wallBand - 0.5);
      expect(dist).toBeLessThan(wallBand + 0.5);
    }
  });

  it('uses both outer and inner sides on each track', () => {
    for (const config of [coastalOvalTrack, nightCityTrack]) {
      const billboards = placeBillboards({ config });
      const sides = new Set(billboards.map((b) => b.sideSign));
      expect(sides.has(1)).toBe(true);
      expect(sides.has(-1)).toBe(true);
    }
  });

  it('never places billboards inside tribune exclusion zones', () => {
    for (const config of [coastalOvalTrack, nightCityTrack]) {
      const billboards = placeBillboards({ config });
      expect(config.treeExclusionZones.length).toBeGreaterThan(0);

      for (const billboard of billboards) {
        for (const zone of config.treeExclusionZones) {
          expect(isInsideCheckpoint(billboard.x, billboard.z, zone)).toBe(false);
        }
      }
    }
  });

  it('keeps clearance from start/finish line', () => {
    for (const config of [coastalOvalTrack, nightCityTrack]) {
      const billboards = placeBillboards({ config });
      const line = config.startFinishLine;
      const minSq =
        BILLBOARD_PLACEMENT.startFinishClearance * BILLBOARD_PLACEMENT.startFinishClearance;

      for (const billboard of billboards) {
        const dx = billboard.x - line.position[0];
        const dz = billboard.z - line.position[2];
        expect(dx * dx + dz * dz).toBeGreaterThanOrEqual(minSq - 0.01);
      }
    }
  });

  it('keeps Night City billboards clear of street-lamp poles', () => {
    const billboards = placeBillboards({ config: nightCityTrack });
    const lamps = placeStreetLamps({ config: nightCityTrack });
    expect(lamps.length).toBeGreaterThan(0);

    const minDist = BILLBOARD_PLACEMENT.minLampClearance;
    for (const billboard of billboards) {
      for (const lamp of lamps) {
        const dist = Math.hypot(billboard.x - lamp.x, billboard.z - lamp.z);
        expect(dist).toBeGreaterThanOrEqual(minDist - 0.01);
      }
    }
  });

  it('faces all billboards the same way along the track (not flipped by side)', () => {
    for (const config of [coastalOvalTrack, nightCityTrack]) {
      const billboards = placeBillboards({ config });
      expect(billboards.length).toBeGreaterThan(1);

      for (const billboard of billboards) {
        const facingX = Math.cos(billboard.rotationY);
        const facingZ = -Math.sin(billboard.rotationY);

        // Ближайший сегмент centerline и его касательная (рост индекса)
        let bestDist = Infinity;
        let tx = 0;
        let tz = 0;
        const points = config.centerline;
        for (let i = 0; i < points.length; i += 1) {
          const a = points[i];
          const b = points[(i + 1) % points.length];
          if (!a || !b) {
            continue;
          }
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const lenSq = dx * dx + dz * dz;
          const t =
            lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((billboard.x - a.x) * dx + (billboard.z - a.z) * dz) / lenSq));
          const px = a.x + dx * t;
          const pz = a.z + dz * t;
          const dist = Math.hypot(billboard.x - px, billboard.z - pz);
          if (dist < bestDist) {
            bestDist = dist;
            const len = Math.hypot(dx, dz) || 1;
            tx = dx / len;
            tz = dz / len;
          }
        }

        // Нормаль панели сонаправлена с касательной, а не против неё
        const alignment = facingX * tx + facingZ * tz;
        expect(alignment).toBeGreaterThan(0.85);
      }
    }
  });

  it('is deterministic for the same config', () => {
    expect(placeBillboards({ config: coastalOvalTrack })).toEqual(
      placeBillboards({ config: coastalOvalTrack }),
    );
    expect(placeBillboards({ config: nightCityTrack })).toEqual(
      placeBillboards({ config: nightCityTrack }),
    );
  });

  it('returns empty for empty centerline', () => {
    const empty = {
      ...coastalOvalTrack,
      centerline: [] as TLoopPoint[],
    };
    expect(placeBillboards({ config: empty })).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  coastalOvalTrack,
  getAllTrackConfigs,
  isInsideCheckpoint,
  nightCityTrack,
  placeTrackTrees,
  TREE_PLACEMENT_LIMITS,
} from './index';
import type { TLoopPoint, TTrackConfig } from './config.types';

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

describe('placeTrackTrees', () => {
  it('places trees on both tracks with exclusion zones', () => {
    const configs = getAllTrackConfigs();

    for (const config of configs) {
      const trees = placeTrackTrees({ config });

      expect(config.treeExclusionZones.length).toBeGreaterThan(0);
      expect(trees.length).toBeGreaterThan(40);
    }
  });

  it('keeps tree count within GPU budget', () => {
    const coastal = placeTrackTrees({ config: coastalOvalTrack });
    const night = placeTrackTrees({ config: nightCityTrack });

    expect(coastal.length).toBeLessThanOrEqual(TREE_PLACEMENT_LIMITS.coastalMax);
    expect(night.length).toBeLessThanOrEqual(TREE_PLACEMENT_LIMITS.nightMax);
  });

  it('keeps trees outside the track corridor', () => {
    for (const config of getAllTrackConfigs()) {
      const corridor =
        config.roadWidth / 2 + 0.5 + TREE_PLACEMENT_LIMITS.corridorRunoff;

      const trees = placeTrackTrees({ config });

      for (const tree of trees) {
        expect(distanceToCenterline(tree.x, tree.z, config.centerline)).toBeGreaterThanOrEqual(
          corridor - 0.01,
        );
      }
    }
  });

  it('never places trees inside tribune exclusion zones', () => {
    for (const config of getAllTrackConfigs()) {
      const trees = placeTrackTrees({ config });
      const zone = config.treeExclusionZones[0];
      expect(zone).toBeDefined();
      if (!zone) {
        continue;
      }

      expect(isInsideCheckpoint(zone.position[0], zone.position[2], zone)).toBe(true);

      for (const tree of trees) {
        for (const exclusion of config.treeExclusionZones) {
          expect(isInsideCheckpoint(tree.x, tree.z, exclusion)).toBe(false);
        }
      }
    }
  });

  it('is deterministic for the same track config', () => {
    const config: TTrackConfig = coastalOvalTrack;

    const first = placeTrackTrees({ config });
    const second = placeTrackTrees({ config });

    expect(first).toEqual(second);
  });
});

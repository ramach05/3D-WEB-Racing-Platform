import { describe, expect, it } from 'vitest';
import { coastalOvalTrack, nightCityTrack } from '@/entities/track';
import { buildTerrainGeometry, buildTerrainHeightfieldArgs } from './terrain-geometry';
import { TRACK_TERRAIN, terrainSeedForSlug } from './terrain-height';

describe('buildTerrainGeometry', () => {
  it.each([nightCityTrack, coastalOvalTrack])(
    'builds a heightfield with expected vertex count for $slug',
    (track) => {
      const segments = 32;
      const geometry = buildTerrainGeometry({
        centerline: track.centerline,
        roadWidth: track.roadWidth,
        worldSize: TRACK_TERRAIN.worldSize,
        segments,
        seed: terrainSeedForSlug(track.slug),
      });

      const positions = geometry.getAttribute('position');
      expect(positions.count).toBe((segments + 1) ** 2);

      let maxY = -Infinity;
      for (let i = 0; i < positions.count; i += 1) {
        maxY = Math.max(maxY, positions.getY(i));
      }
      expect(maxY).toBeGreaterThan(3);
      geometry.dispose();
    },
  );
});

describe('buildTerrainHeightfieldArgs', () => {
  it('matches Rapier cell grid: (segs+1)^2 heights in column-major order', () => {
    const segments = 16;
    const [nrows, ncols, heights, scale] = buildTerrainHeightfieldArgs({
      centerline: coastalOvalTrack.centerline,
      roadWidth: coastalOvalTrack.roadWidth,
      worldSize: 200,
      segments,
      seed: terrainSeedForSlug(coastalOvalTrack.slug),
    });

    expect(nrows).toBe(segments);
    expect(ncols).toBe(segments);
    expect(heights).toHaveLength((segments + 1) ** 2);
    expect(scale).toEqual({ x: 200, y: 1, z: 200 });
    expect(Math.max(...heights)).toBeGreaterThan(2);
    expect(Array.from(heights).every((h) => Number.isFinite(h) && h >= 0)).toBe(true);
  });
});

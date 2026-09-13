import { describe, expect, it } from 'vitest';
import { coastalOvalTrack, nightCityTrack } from '@/entities/track';
import {
  TRACK_TERRAIN,
  basinFlatRadius,
  distanceToCenterlineSq,
  sampleTerrainHeight,
  terrainSeedForSlug,
} from './terrain-height';

describe('sampleTerrainHeight', () => {
  it.each([
    ['night-city', nightCityTrack],
    ['coastal-oval', coastalOvalTrack],
  ] as const)('is nearly flat on and near the centerline (%s)', (_slug, track) => {
    const { centerline, roadWidth } = track;
    const seed = terrainSeedForSlug(track.slug);
    const opts = { centerline, roadWidth, seed };
    const point = centerline[0]!;
    expect(sampleTerrainHeight(point.x, point.z, opts)).toBe(0);

    const mid = centerline[Math.floor(centerline.length / 4)]!;
    expect(sampleTerrainHeight(mid.x, mid.z, opts)).toBe(0);

    const flatR = basinFlatRadius(roadWidth);
    expect(sampleTerrainHeight(point.x + flatR * 0.4, point.z, opts)).toBe(0);
  });

  it.each([
    ['night-city', nightCityTrack],
    ['coastal-oval', coastalOvalTrack],
  ] as const)('rises outside the basin into soft hill range (%s)', (_slug, track) => {
    const seed = terrainSeedForSlug(track.slug);
    const opts = { centerline: track.centerline, roadWidth: track.roadWidth, seed };
    const samples = [
      sampleTerrainHeight(120, 0, opts),
      sampleTerrainHeight(-110, 80, opts),
      sampleTerrainHeight(0, -130, opts),
      sampleTerrainHeight(90, 90, opts),
    ];

    for (const h of samples) {
      expect(h).toBeGreaterThan(1.2);
      expect(h).toBeLessThan(14);
    }
    expect(Math.max(...samples)).toBeGreaterThan(3);
  });

  it('blends smoothly on Night City outer edge', () => {
    const { centerline, roadWidth } = nightCityTrack;
    const opts = { centerline, roadWidth, seed: terrainSeedForSlug(nightCityTrack.slug) };
    const flatR = basinFlatRadius(roadWidth);
    const edgeX = 36 + flatR + 2;
    const farX = 36 + flatR + TRACK_TERRAIN.basinBlendWidth + 40;
    const near = sampleTerrainHeight(edgeX, 0, opts);
    const far = sampleTerrainHeight(farX, 0, opts);
    expect(near).toBeLessThan(far);
  });

  it('uses different seeds for coastal and night so landscapes differ', () => {
    expect(terrainSeedForSlug(nightCityTrack.slug)).not.toBe(
      terrainSeedForSlug(coastalOvalTrack.slug),
    );
    const nightH = sampleTerrainHeight(95, -40, {
      centerline: nightCityTrack.centerline,
      roadWidth: nightCityTrack.roadWidth,
      seed: terrainSeedForSlug(nightCityTrack.slug),
    });
    const coastalH = sampleTerrainHeight(95, -40, {
      centerline: coastalOvalTrack.centerline,
      roadWidth: coastalOvalTrack.roadWidth,
      seed: terrainSeedForSlug(coastalOvalTrack.slug),
    });
    expect(nightH).not.toBe(coastalH);
  });
});

describe('distanceToCenterlineSq', () => {
  it('is zero on a segment endpoint', () => {
    const line = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
    ];
    expect(distanceToCenterlineSq(0, 0, line)).toBe(0);
    expect(distanceToCenterlineSq(10, 0, line)).toBe(0);
    expect(distanceToCenterlineSq(5, 3, line)).toBeCloseTo(9, 5);
  });
});

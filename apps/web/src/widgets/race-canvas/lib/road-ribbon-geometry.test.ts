import { describe, expect, it } from 'vitest';
import { coastalOvalTrack, nightCityTrack } from '@/entities/track';
import {
  ROAD_THICKNESS,
  ROAD_TOP_Y,
  buildRoadRibbonGeometry,
} from './road-ribbon-geometry';

describe('buildRoadRibbonGeometry', () => {
  it('returns empty geometry for short centerline', () => {
    const { geometry, pathLength } = buildRoadRibbonGeometry([{ x: 0, z: 0 }], 10);
    expect(pathLength).toBe(0);
    expect(geometry.getAttribute('position')).toBeUndefined();
    geometry.dispose();
  });

  it('builds a closed ribbon with expected vertex and index counts', () => {
    const square = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 10 },
      { x: 0, z: 10 },
    ];
    const roadWidth = 4;
    const { geometry, pathLength } = buildRoadRibbonGeometry(square, roadWidth);

    expect(pathLength).toBeCloseTo(40, 5);

    const positions = geometry.getAttribute('position');
    const index = geometry.getIndex();
    expect(positions).toBeTruthy();
    expect(index).toBeTruthy();
    // stations = n+1, 4 verts each
    expect(positions!.count).toBe((square.length + 1) * 4);
    // n segments × 8 triangles × 3 indices
    expect(index!.count).toBe(square.length * 8 * 3);

    let maxY = -Infinity;
    let minY = Infinity;
    for (let i = 0; i < positions!.count; i += 1) {
      const y = positions!.getY(i);
      maxY = Math.max(maxY, y);
      minY = Math.min(minY, y);
    }
    expect(maxY).toBeCloseTo(ROAD_TOP_Y, 5);
    expect(minY).toBeCloseTo(ROAD_TOP_Y - ROAD_THICKNESS, 5);

    geometry.dispose();
  });

  it('produces finite geometry for coastal and night city tracks', () => {
    for (const config of [coastalOvalTrack, nightCityTrack]) {
      const { geometry, pathLength } = buildRoadRibbonGeometry(
        config.centerline,
        config.roadWidth,
      );
      expect(pathLength).toBeGreaterThan(100);

      const positions = geometry.getAttribute('position');
      expect(positions).toBeTruthy();
      for (let i = 0; i < positions!.count; i += 1) {
        expect(Number.isFinite(positions!.getX(i))).toBe(true);
        expect(Number.isFinite(positions!.getY(i))).toBe(true);
        expect(Number.isFinite(positions!.getZ(i))).toBe(true);
      }

      geometry.dispose();
    }
  });
});

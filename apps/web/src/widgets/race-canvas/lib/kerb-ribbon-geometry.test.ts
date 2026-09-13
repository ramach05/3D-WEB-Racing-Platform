import { describe, expect, it } from 'vitest';
import { coastalOvalTrack, nightCityTrack } from '@/entities/track';
import {
  KERB_STRIPE_LENGTH,
  KERB_THICKNESS,
  KERB_TOP_Y,
  KERB_WIDTH,
  buildKerbRibbonGeometry,
} from './kerb-ribbon-geometry';

describe('buildKerbRibbonGeometry', () => {
  it('returns empty geometry for short centerline', () => {
    const { geometry, pathLength } = buildKerbRibbonGeometry([{ x: 0, z: 0 }], 10, 1);
    expect(pathLength).toBe(0);
    expect(geometry.getAttribute('position')).toBeUndefined();
    geometry.dispose();
  });

  it('builds a closed kerb ribbon with expected counts', () => {
    const square = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 10 },
      { x: 0, z: 10 },
    ];
    const { geometry, pathLength } = buildKerbRibbonGeometry(square, 4, 1, KERB_WIDTH);

    expect(pathLength).toBeCloseTo(40, 5);
    const positions = geometry.getAttribute('position');
    const index = geometry.getIndex();
    expect(positions).toBeTruthy();
    expect(index).toBeTruthy();
    expect(positions!.count).toBe((square.length + 1) * 4);
    expect(index!.count).toBe(square.length * 8 * 3);

    let maxY = -Infinity;
    let minY = Infinity;
    for (let i = 0; i < positions!.count; i += 1) {
      maxY = Math.max(maxY, positions!.getY(i));
      minY = Math.min(minY, positions!.getY(i));
    }
    expect(maxY).toBeCloseTo(KERB_TOP_Y, 5);
    expect(minY).toBeCloseTo(KERB_TOP_Y - KERB_THICKNESS, 5);

    geometry.dispose();
  });

  it('produces finite geometry for both track edges', () => {
    for (const config of [coastalOvalTrack, nightCityTrack]) {
      for (const side of [1, -1] as const) {
        const { geometry, pathLength } = buildKerbRibbonGeometry(
          config.centerline,
          config.roadWidth,
          side,
        );
        expect(pathLength).toBeGreaterThan(100);
        expect(pathLength / KERB_STRIPE_LENGTH).toBeGreaterThan(10);

        const positions = geometry.getAttribute('position');
        expect(positions).toBeTruthy();
        for (let i = 0; i < positions!.count; i += 1) {
          expect(Number.isFinite(positions!.getX(i))).toBe(true);
          expect(Number.isFinite(positions!.getY(i))).toBe(true);
          expect(Number.isFinite(positions!.getZ(i))).toBe(true);
        }
        geometry.dispose();
      }
    }
  });
});

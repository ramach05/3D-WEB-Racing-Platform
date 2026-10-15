import { describe, expect, it } from 'vitest';
import type { TLoopPoint } from '@/entities/track';
import { VEHICLE_LATERAL_GRIP } from '@/features/race-session';
import { KERB_WIDTH } from '@/widgets/race-canvas/lib/kerb-ribbon-geometry';
import {
  KERB_LATERAL_GRIP,
  OFFROAD_LATERAL_GRIP,
  OFFROAD_THROTTLE_FACTOR,
  aggregateWheelSurfaces,
  applyOffroadThrottleFactor,
  combineSurfaceGrip,
  computeKerbRumble,
  computeOffroadFxStrength,
  sampleAsphaltMicroGrip,
  sampleTrackSurfaceKind,
} from './track-surface';

const square: TLoopPoint[] = [
  { x: 0, z: 0 },
  { x: 40, z: 0 },
  { x: 40, z: 40 },
  { x: 0, z: 40 },
];

const ROAD_WIDTH = 10;
const HALF = ROAD_WIDTH / 2;

describe('sampleTrackSurfaceKind', () => {
  it('classifies asphalt, kerb and offroad by lateral distance', () => {
    expect(sampleTrackSurfaceKind(20, 0, square, ROAD_WIDTH)).toBe('asphalt');
    expect(sampleTrackSurfaceKind(20, HALF - KERB_WIDTH / 2, square, ROAD_WIDTH)).toBe('kerb');
    expect(sampleTrackSurfaceKind(20, HALF + 0.5, square, ROAD_WIDTH)).toBe('offroad');
  });

  it('treats the asphalt/kerb boundary as kerb', () => {
    const onBoundary = HALF - KERB_WIDTH + 0.001;
    expect(sampleTrackSurfaceKind(20, onBoundary, square, ROAD_WIDTH)).toBe('kerb');
    expect(sampleTrackSurfaceKind(20, HALF - KERB_WIDTH - 0.05, square, ROAD_WIDTH)).toBe(
      'asphalt',
    );
  });
});

describe('aggregateWheelSurfaces', () => {
  it('returns fractions for mixed wheels', () => {
    expect(aggregateWheelSurfaces(['asphalt', 'asphalt', 'kerb', 'offroad'])).toEqual({
      asphalt: 0.5,
      kerb: 0.25,
      offroad: 0.25,
    });
  });
});

describe('combineSurfaceGrip', () => {
  it('starts from asphalt micro grip', () => {
    expect(combineSurfaceGrip(undefined, 0, 0, 1)).toBeCloseTo(VEHICLE_LATERAL_GRIP, 5);
    expect(combineSurfaceGrip(undefined, 0, 0, 0.92)).toBeCloseTo(VEHICLE_LATERAL_GRIP * 0.92, 5);
  });

  it('blends kerb then offroad, and oil beats both', () => {
    const kerbOnly = combineSurfaceGrip(undefined, 0, 1, 1);
    expect(kerbOnly).toBeCloseTo(KERB_LATERAL_GRIP, 5);

    const offOnly = combineSurfaceGrip(undefined, 1, 0, 1);
    expect(offOnly).toBeCloseTo(OFFROAD_LATERAL_GRIP, 5);

    const oil = 2.2;
    expect(combineSurfaceGrip(oil, 1, 1, 1)).toBe(oil);
  });
});

describe('sampleAsphaltMicroGrip', () => {
  it('stays in 0.92…1.05 and is deterministic', () => {
    const a = sampleAsphaltMicroGrip(12.5, -3.2);
    const b = sampleAsphaltMicroGrip(12.5, -3.2);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0.92);
    expect(a).toBeLessThanOrEqual(1.05);
  });
});

describe('offroad helpers', () => {
  it('softens throttle on offroad', () => {
    const next = applyOffroadThrottleFactor(20, 22, 1, 1);
    expect(next).toBeCloseTo(20 + 2 * OFFROAD_THROTTLE_FACTOR, 5);
    expect(applyOffroadThrottleFactor(20, 18, 1, 1)).toBe(18);
  });

  it('scales fx with speed and fraction', () => {
    expect(computeOffroadFxStrength(1, 2)).toBe(0);
    expect(computeOffroadFxStrength(1, 22)).toBe(1);
    expect(computeKerbRumble(0, 20)).toBe(0);
    expect(computeKerbRumble(1, 22)).toBeGreaterThan(0.5);
  });
});

import { describe, expect, it } from 'vitest';
import {
  VEHICLE_TARGET_LENGTH,
  VEHICLE_TARGET_WIDTH,
  computeVehicleFit,
  fittedLength,
  fittedWidth,
} from './vehicle-fit';

/** CarConcept.glb dimensions (meters), taken via Three.js Box3 */
const CAR_CONCEPT_BOUNDS = {
  size: { x: 2.716158700804741, y: 1.307954089198598, z: 4.357385993003845 },
  min: { x: -1.363296299549969, y: -0.15929903224516784, z: -1.940231204032898 },
  center: { x: -0.005216949147598404, y: 0.49467801235413117, z: 0.23846179246902466 },
};

describe('computeVehicleFit', () => {
  it('scales CarConcept length to the capsule target', () => {
    const fit = computeVehicleFit(CAR_CONCEPT_BOUNDS);
    expect(fittedLength(CAR_CONCEPT_BOUNDS, fit)).toBeCloseTo(VEHICLE_TARGET_LENGTH, 5);
    expect(fit.scale).toBeCloseTo(VEHICLE_TARGET_LENGTH / CAR_CONCEPT_BOUNDS.size.z, 5);
  });

  it('grounds the AABB bottom at y=0 and centers xz', () => {
    const fit = computeVehicleFit(CAR_CONCEPT_BOUNDS);
    expect(fit.offset.y).toBeCloseTo(-CAR_CONCEPT_BOUNDS.min.y * fit.scale, 5);
    expect(fit.offset.x).toBeCloseTo(-CAR_CONCEPT_BOUNDS.center.x * fit.scale, 5);
    expect(fit.offset.z).toBeCloseTo(-CAR_CONCEPT_BOUNDS.center.z * fit.scale, 5);
  });

  it('honors an explicit per-class target length', () => {
    const fit = computeVehicleFit(CAR_CONCEPT_BOUNDS, 3.8);
    expect(fittedLength(CAR_CONCEPT_BOUNDS, fit)).toBeCloseTo(3.8, 5);
    expect(fit.scale).toBeCloseTo(3.8 / CAR_CONCEPT_BOUNDS.size.z, 5);
  });

  it('keeps fitted width near the capsule footprint', () => {
    const fit = computeVehicleFit(CAR_CONCEPT_BOUNDS);
    const width = fittedWidth(CAR_CONCEPT_BOUNDS, fit);
    // Length matters more than width: allow visual overhang relative to the capsule
    expect(width).toBeGreaterThan(VEHICLE_TARGET_WIDTH * 0.9);
    expect(width).toBeLessThan(VEHICLE_TARGET_WIDTH * 1.4);
  });
});

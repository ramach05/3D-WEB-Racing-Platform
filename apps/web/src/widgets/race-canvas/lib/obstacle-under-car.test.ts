import { describe, expect, it } from 'vitest';
import {
  CAR_UNDER_HALF_LENGTH,
  CAR_UNDER_HALF_WIDTH,
  isObstacleUnderCar,
} from './obstacle-under-car';

const CAR = { x: 0, y: 0.82, z: 0 };

describe('isObstacleUnderCar', () => {
  it('detects an obstacle under the chassis, centered', () => {
    expect(
      isObstacleUnderCar({
        carPosition: CAR,
        carForward: { x: 0, z: 1 },
        obstaclePosition: { x: 0, y: 0.3, z: 0.5 },
      }),
    ).toBe(true);
  });

  it('uses car axes when the car is turned', () => {
    // heading along X: an obstacle one meter along X from the car is under the body
    expect(
      isObstacleUnderCar({
        carPosition: CAR,
        carForward: { x: 1, z: 0 },
        obstaclePosition: { x: 1, y: 0.3, z: 0 },
      }),
    ).toBe(true);
    // but one meter along Z (from the side) — already outside the width footprint
    expect(
      isObstacleUnderCar({
        carPosition: CAR,
        carForward: { x: 1, z: 0 },
        obstaclePosition: { x: 0, y: 0.3, z: CAR_UNDER_HALF_WIDTH + 0.1 },
      }),
    ).toBe(false);
  });

  it('is false beyond the chassis footprint', () => {
    expect(
      isObstacleUnderCar({
        carPosition: CAR,
        carForward: { x: 0, z: 1 },
        obstaclePosition: { x: 0, y: 0.3, z: CAR_UNDER_HALF_LENGTH + 0.1 },
      }),
    ).toBe(false);
  });

  it('is false for an obstacle above the car floor (on the roof, not under)', () => {
    expect(
      isObstacleUnderCar({
        carPosition: CAR,
        carForward: { x: 0, z: 1 },
        obstaclePosition: { x: 0, y: 1.2, z: 0 },
      }),
    ).toBe(false);
  });

  it('is false for a degenerate forward vector', () => {
    expect(
      isObstacleUnderCar({
        carPosition: CAR,
        carForward: { x: 0, z: 0 },
        obstaclePosition: { x: 0, y: 0.3, z: 0 },
      }),
    ).toBe(false);
  });

  it('tolerates a non-normalized forward vector', () => {
    expect(
      isObstacleUnderCar({
        carPosition: CAR,
        carForward: { x: 0, z: 7 },
        obstaclePosition: { x: 0, y: 0.3, z: 1 },
      }),
    ).toBe(true);
  });
});

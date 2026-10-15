import { beforeEach, describe, expect, it } from 'vitest';
import {
  HIT_THROTTLE_MS,
  isObstacleHitThrottled,
  resetObstacleHitThrottle,
} from './tire-hit-throttle';

describe('obstacle hit throttle', () => {
  beforeEach(() => {
    resetObstacleHitThrottle();
  });

  it('passes the first hit and throttles repeats within the window', () => {
    expect(isObstacleHitThrottled(1, 0)).toBe(false);
    expect(isObstacleHitThrottled(1, HIT_THROTTLE_MS / 2)).toBe(true);
  });

  it('passes again after the window expires', () => {
    isObstacleHitThrottled(1, 0);

    expect(isObstacleHitThrottled(1, HIT_THROTTLE_MS)).toBe(false);
  });

  it('tracks bodies independently', () => {
    isObstacleHitThrottled(1, 0);

    expect(isObstacleHitThrottled(2, 1)).toBe(false);
    expect(isObstacleHitThrottled(1, 1)).toBe(true);
  });

  it('restarts the window on a passed hit', () => {
    isObstacleHitThrottled(1, 0);
    isObstacleHitThrottled(1, HIT_THROTTLE_MS);

    expect(isObstacleHitThrottled(1, HIT_THROTTLE_MS * 1.5)).toBe(true);
  });

  it('forgets bodies after reset', () => {
    isObstacleHitThrottled(1, 0);
    resetObstacleHitThrottle();

    expect(isObstacleHitThrottled(1, 1)).toBe(false);
  });
});

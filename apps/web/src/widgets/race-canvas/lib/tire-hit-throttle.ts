/**
 * Response throttling for obstacle hits: during solver churn the same "tire <-> car" pair
 * re-enters contact many times in a row. Without this module's window, the speed penalty,
 * sound and shake would restart on every collisionEnter and persist for the whole contact.
 * The "bumped off the bumper" impulse is preserved even while throttled.
 */

/** Window in which a repeated hit of the same body gets no penalty/sound/shake, ms */
export const HIT_THROTTLE_MS = 400;

const lastHitAtByHandle = new Map<number, number>();

/** true — skip the response (window open); false — first hit, window restarts */
export const isObstacleHitThrottled = (handle: number, nowMs: number): boolean => {
  const last = lastHitAtByHandle.get(handle);
  if (last !== undefined && nowMs - last < HIT_THROTTLE_MS) {
    return true;
  }
  lastHitAtByHandle.set(handle, nowMs);
  return false;
};

/** Forget all windows (race start/restart: body handles are recreated) */
export const resetObstacleHitThrottle = (): void => {
  lastHitAtByHandle.clear();
};

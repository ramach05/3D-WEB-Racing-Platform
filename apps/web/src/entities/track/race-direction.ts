/**
 * Race direction relative to the centerline.
 *
 * The centerline is a closed polyline; `ratio` grows with point index (0 → 1).
 * The car at the start faces AGAINST index growth: `spawnRotationY = atan2(dx, dz) + π`.
 * Track-painting arrows and respawn use the same direction.
 *
 * In finish-line local coordinates (`getTrackLineLocalCoords`):
 * - spawn is on the `lz > 0` side;
 * - a lap counts only when crossing `lz: + → −` (from spawn through the line);
 * - lap travel accumulates with a DECREASING `ratio` (see `accumulateLapTravel`).
 *
 * Do not confuse "forward along the centerline" (ratio growth) with "forward in the race" (ratio decrease).
 */

/** Yaw difference: centerline tangent → car nose at the start. */
export const CENTERLINE_TO_RACE_YAW_OFFSET = Math.PI;

/** Yaw along a centerline segment (index growth). */
export const yawAlongCenterline = (dx: number, dz: number): number => Math.atan2(dx, dz);

/** Yaw facing the race / respawn direction (against centerline index growth). */
export const yawFacingRaceDirection = (dx: number, dz: number): number =>
  yawAlongCenterline(dx, dz) + CENTERLINE_TO_RACE_YAW_OFFSET;

/** After a lap counts, ratio ≈ 1; the cooldown clears once the car left the finish toward decreasing ratio (typical race path). */
export const isRaceLapCooldownCleared = (ratio: number, cooldownRatio: number): boolean =>
  ratio < 1 - cooldownRatio;

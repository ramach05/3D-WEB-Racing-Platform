/**
 * Направление заезда относительно centerline.
 *
 * Centerline — замкнутый полилайн; `ratio` растёт с индексом точек (0 → 1).
 * Машина на старте смотрит ПРОТИВ роста индекса: `spawnRotationY = atan2(dx, dz) + π`.
 * Стрелки на разметке и респавн задают то же направление.
 *
 * В локальных координатах финиша (`getTrackLineLocalCoords`):
 * - спавн на стороне `lz > 0`;
 * - круг засчитывается только при проезде `lz: + → −` (от спавна через линию);
 * - travel круга копится при УБЫВАЮЩЕМ `ratio` (см. `accumulateLapTravel`).
 *
 * Не путать «вперёд по centerline» (рост ratio) с «вперёд по заезду» (падение ratio).
 */

/** Разница yaw: касательная centerline → нос машины на старте. */
export const CENTERLINE_TO_RACE_YAW_OFFSET = Math.PI;

/** Yaw вдоль сегмента centerline (рост индекса). */
export const yawAlongCenterline = (dx: number, dz: number): number => Math.atan2(dx, dz);

/** Yaw в направлении заезда / респавна (против роста индекса centerline). */
export const yawFacingRaceDirection = (dx: number, dz: number): number =>
  yawAlongCenterline(dx, dz) + CENTERLINE_TO_RACE_YAW_OFFSET;

/**
 * После засчёта круга ratio ≈ 1; cooldown снимаем, когда уехали от финиша
 * в сторону убывающего ratio (типичный путь заезда).
 */
export const isRaceLapCooldownCleared = (ratio: number, cooldownRatio: number): boolean =>
  ratio < 1 - cooldownRatio;

import { VEHICLE_MAX_SPEED } from '@/features/race-session';
import type { TCameraMode } from './camera-mode';

/** Базовый FOV chase-камеры (как в Canvas) */
export const CAMERA_FOV_BASE = 60;

/** FOV на максимальной скорости (chase / tv) */
export const CAMERA_FOV_MAX = 72;

/** Узкий FOV у бампера — без расширения на скорости */
export const CAMERA_FOV_CLOSE = 52;

/** FOV по горизонтальной скорости (м/с). Линейно от базы до max на VEHICLE_MAX_SPEED. */
export const mapSpeedToFov = (speedMs: number): number => {
  if (speedMs <= 0 || VEHICLE_MAX_SPEED <= 0) {
    return CAMERA_FOV_BASE;
  }
  const t = Math.min(1, speedMs / VEHICLE_MAX_SPEED);
  return CAMERA_FOV_BASE + (CAMERA_FOV_MAX - CAMERA_FOV_BASE) * t;
};

/** FOV для режима камеры. bumper — фиксированный узкий угол; chase/tv — от скорости. */
export const mapModeSpeedToFov = (mode: TCameraMode, speedMs: number): number => {
  if (mode === 'bumper') {
    return CAMERA_FOV_CLOSE;
  }
  return mapSpeedToFov(speedMs);
};

import { VEHICLE_MAX_SPEED } from '@/features/race-session';
import type { TCameraMode } from './camera-mode';

/** Base FOV of the chase camera (as in Canvas) */
export const CAMERA_FOV_BASE = 60;

/** FOV at maximum speed (chase / tv) */
export const CAMERA_FOV_MAX = 72;

/** Narrow FOV at the bumper — no speed-based widening */
export const CAMERA_FOV_CLOSE = 52;

/** FOV from horizontal speed (m/s). Linear from base to max at VEHICLE_MAX_SPEED. */
export const mapSpeedToFov = (speedMs: number): number => {
  if (speedMs <= 0 || VEHICLE_MAX_SPEED <= 0) {
    return CAMERA_FOV_BASE;
  }
  const t = Math.min(1, speedMs / VEHICLE_MAX_SPEED);
  return CAMERA_FOV_BASE + (CAMERA_FOV_MAX - CAMERA_FOV_BASE) * t;
};

/** FOV for the camera mode. bumper — fixed narrow angle; chase/tv — speed-based. */
export const mapModeSpeedToFov = (mode: TCameraMode, speedMs: number): number => {
  if (mode === 'bumper') {
    return CAMERA_FOV_CLOSE;
  }
  return mapSpeedToFov(speedMs);
};

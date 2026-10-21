import { useSyncExternalStore } from 'react';

export type TCameraMode = 'chase' | 'bumper' | 'tv';

/** Switching order for the C key */
export const CAMERA_MODE_ORDER: readonly TCameraMode[] = ['chase', 'bumper', 'tv'] as const;

type TListener = () => void;

let mode: TCameraMode = 'chase';
const listeners = new Set<TListener>();

/** Normalizes the mode if a stale one remains (e.g. hood) */
const sanitizeMode = (): void => {
  if (!CAMERA_MODE_ORDER.includes(mode)) {
    mode = 'chase';
  }
};

/** Notifies UI subscribers */
const notify = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

/** Subscribe to mode changes (for the HUD) */
export const subscribeCameraMode = (listener: TListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Current camera mode */
export const getCameraMode = (): TCameraMode => {
  sanitizeMode();
  return mode;
};

/** Next mode in the cycle; returns the new one */
export const cycleCameraMode = (): TCameraMode => {
  sanitizeMode();
  const index = CAMERA_MODE_ORDER.indexOf(mode);
  const next = CAMERA_MODE_ORDER[(index + 1) % CAMERA_MODE_ORDER.length] ?? 'chase';
  mode = next;
  notify();
  return mode;
};

/** Reset to chase (leaving the race / switching tracks) */
export const resetCameraMode = (): void => {
  if (mode === 'chase') {
    return;
  }
  mode = 'chase';
  notify();
};

/** React hook for the current mode without extra scene rerenders */
export const useCameraMode = (): TCameraMode =>
  useSyncExternalStore(subscribeCameraMode, getCameraMode, getCameraMode);

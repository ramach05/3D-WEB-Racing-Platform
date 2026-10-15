import { useSyncExternalStore } from 'react';

export type TCameraMode = 'chase' | 'bumper' | 'tv';

/** Порядок переключения клавишей C */
export const CAMERA_MODE_ORDER: readonly TCameraMode[] = ['chase', 'bumper', 'tv'] as const;

type TListener = () => void;

let mode: TCameraMode = 'chase';
const listeners = new Set<TListener>();

/** Нормализует режим, если остался устаревший (например hood) */
const sanitizeMode = (): void => {
  if (!CAMERA_MODE_ORDER.includes(mode)) {
    mode = 'chase';
  }
};

/** Уведомляет подписчиков UI */
const notify = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

/** Подписка на смену режима (для HUD) */
export const subscribeCameraMode = (listener: TListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Текущий режим камеры */
export const getCameraMode = (): TCameraMode => {
  sanitizeMode();
  return mode;
};

/** Следующий режим по кругу; возвращает новый */
export const cycleCameraMode = (): TCameraMode => {
  sanitizeMode();
  const index = CAMERA_MODE_ORDER.indexOf(mode);
  const next = CAMERA_MODE_ORDER[(index + 1) % CAMERA_MODE_ORDER.length] ?? 'chase';
  mode = next;
  notify();
  return mode;
};

/** Сброс на chase (выход из гонки / смена трассы) */
export const resetCameraMode = (): void => {
  if (mode === 'chase') {
    return;
  }
  mode = 'chase';
  notify();
};

/** React-хук текущего режима без лишних ререндеров сцены */
export const useCameraMode = (): TCameraMode =>
  useSyncExternalStore(subscribeCameraMode, getCameraMode, getCameraMode);

import type { TDriveInput } from './input.types';

const state: TDriveInput = {
  throttle: 0,
  steer: 0,
  brake: 0,
};

const pressed = new Set<string>();

/** Оси от touch-кнопок (OR с клавиатурой в syncAxes) */
const touch = {
  throttle: false,
  brake: false,
  steerLeft: false,
  steerRight: false,
};

export type TTouchAxis = keyof typeof touch;

/** true, если фокус в поле ввода — клавиши гонки не трогаем */
const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
};

const RACE_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyR',
]);

/** Пересчитывает оси ввода по клавиатуре и touch */
const syncAxes = (): void => {
  const up = pressed.has('KeyW') || pressed.has('ArrowUp') || touch.throttle;
  const down = pressed.has('KeyS') || pressed.has('ArrowDown') || touch.brake;
  const left = pressed.has('KeyA') || pressed.has('ArrowLeft') || touch.steerLeft;
  const right = pressed.has('KeyD') || pressed.has('ArrowRight') || touch.steerRight;
  state.throttle = up ? 1 : 0;
  state.brake = down ? 1 : 0;
  state.steer = (left ? 1 : 0) + (right ? -1 : 0);
};

/** Текущий ввод машины */
export const getDriveInput = (): TDriveInput => state;

/** Включает/выключает ось touch-пада */
export const setTouchAxis = (axis: TTouchAxis, active: boolean): void => {
  touch[axis] = active;
  syncAxes();
};

/** Сбрасывает все touch-оси (unmount / pointercancel) */
export const clearTouchAxes = (): void => {
  touch.throttle = false;
  touch.brake = false;
  touch.steerLeft = false;
  touch.steerRight = false;
  syncAxes();
};

type TInputHandlers = {
  /** Рестарт заезда (R) */
  onRestart: () => void;
  /** Пауза / снятие паузы (Escape) */
  onTogglePause: () => void;
  /** true, пока можно принимать WASD/стрелки */
  isRaceActive: () => boolean;
};

/** Подписывается на клавиши гонки. preventDefault только на WASD/стрелках во время заезда. */
export const bindRaceInput = (handlers: TInputHandlers): (() => void) => {
  /** keydown: оси, Escape, рестарт */
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      return;
    }
    if (isTypingTarget(event.target)) {
      return;
    }
    if (event.code === 'Escape') {
      handlers.onTogglePause();
      return;
    }
    if (!handlers.isRaceActive()) {
      return;
    }
    if (event.code === 'KeyR') {
      event.preventDefault();
      handlers.onRestart();
      return;
    }
    if (!RACE_KEYS.has(event.code)) {
      return;
    }
    event.preventDefault();
    pressed.add(event.code);
    syncAxes();
  };

  /** keyup: сброс нажатой клавиши */
  const onKeyUp = (event: KeyboardEvent): void => {
    if (!RACE_KEYS.has(event.code)) {
      return;
    }
    pressed.delete(event.code);
    syncAxes();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    pressed.clear();
    syncAxes();
  };
};

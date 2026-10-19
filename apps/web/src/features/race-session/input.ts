import type { TDriveInput } from './input.types';

const state: TDriveInput = {
  throttle: 0,
  steer: 0,
  brake: 0,
  handbrake: 0,
};

const pressed = new Set<string>();

/** Axes from touch buttons (OR-ed with the keyboard in syncAxes) */
const touch = {
  throttle: false,
  brake: false,
  handbrake: false,
  steerLeft: false,
  steerRight: false,
};

export type TTouchAxis = keyof typeof touch;

/** true when focus is inside an input field — race keys are left alone */
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
  'Space',
  'KeyR',
]);

/** Recomputes input axes from keyboard and touch */
const syncAxes = (): void => {
  const up = pressed.has('KeyW') || pressed.has('ArrowUp') || touch.throttle;
  const down = pressed.has('KeyS') || pressed.has('ArrowDown') || touch.brake;
  const left = pressed.has('KeyA') || pressed.has('ArrowLeft') || touch.steerLeft;
  const right = pressed.has('KeyD') || pressed.has('ArrowRight') || touch.steerRight;
  const handbrake = pressed.has('Space') || touch.handbrake;
  state.throttle = up ? 1 : 0;
  state.brake = down ? 1 : 0;
  state.handbrake = handbrake ? 1 : 0;
  state.steer = (left ? 1 : 0) + (right ? -1 : 0);
};

/** Current vehicle input */
export const getDriveInput = (): TDriveInput => state;

/** Turns a touch-pad axis on/off */
export const setTouchAxis = (axis: TTouchAxis, active: boolean): void => {
  touch[axis] = active;
  syncAxes();
};

/** Clears all touch axes (unmount / pointercancel) */
export const clearTouchAxes = (): void => {
  touch.throttle = false;
  touch.brake = false;
  touch.handbrake = false;
  touch.steerLeft = false;
  touch.steerRight = false;
  syncAxes();
};

type TInputHandlers = {
  /** Race restart (R) */
  onRestart: () => void;
  /** Pause / resume (Escape) */
  onTogglePause: () => void;
  /** Camera mode cycling (C) */
  onCycleCamera: () => void;
  /** true while WASD/arrow keys may be accepted */
  isRaceActive: () => boolean;
};

/** Subscribes to race keys. preventDefault only on WASD/arrows during a race. */
export const bindRaceInput = (handlers: TInputHandlers): (() => void) => {
  // keydown: axes, Escape, restart, camera
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
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }
      event.preventDefault();
      handlers.onRestart();
      return;
    }
    if (event.code === 'KeyC') {
      event.preventDefault();
      handlers.onCycleCamera();
      return;
    }
    if (!RACE_KEYS.has(event.code)) {
      return;
    }
    event.preventDefault();
    pressed.add(event.code);
    syncAxes();
  };

  // keyup: release of a pressed key
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

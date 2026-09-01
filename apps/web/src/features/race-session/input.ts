export type DriveInput = {
  throttle: number;
  steer: number;
  brake: number;
};

const state: DriveInput = {
  throttle: 0,
  steer: 0,
  brake: 0,
};

const pressed = new Set<string>();

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

/** Пересчитывает оси ввода по нажатым клавишам */
const syncAxes = (): void => {
  const up = pressed.has('KeyW') || pressed.has('ArrowUp');
  const down = pressed.has('KeyS') || pressed.has('ArrowDown');
  const left = pressed.has('KeyA') || pressed.has('ArrowLeft');
  const right = pressed.has('KeyD') || pressed.has('ArrowRight');
  state.throttle = up ? 1 : 0;
  state.brake = down ? 1 : 0;
  state.steer = (left ? 1 : 0) + (right ? -1 : 0);
};

/** Текущий ввод машины */
export const getDriveInput = (): DriveInput => state;

type InputHandlers = {
  onRestart: () => void;
  onTogglePause: () => void;
  isRaceActive: () => boolean;
};

/** Подписывается на клавиши гонки. preventDefault только на WASD/стрелках во время заезда. */
export const bindRaceInput = (handlers: InputHandlers): (() => void) => {
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

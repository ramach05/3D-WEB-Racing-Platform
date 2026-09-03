export type RacePerfSnapshot = {
  fps: number;
  ms: number;
};

type Listener = () => void;

let snapshot: RacePerfSnapshot = { fps: 0, ms: 0 };
let frameCount = 0;
let accumulatedMs = 0;
let lastSampleAt = 0;
let lastNotifyAt = 0;
const listeners = new Set<Listener>();

/** Подписка HUD на снимок производительности */
export const subscribeRacePerf = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Текущий снимок производительности */
export const getRacePerfSnapshot = (): RacePerfSnapshot => snapshot;

const emit = (): void => {
  const now = performance.now();
  if (now - lastNotifyAt < 250) {
    return;
  }
  lastNotifyAt = now;
  listeners.forEach((listener) => listener());
};

/** Тик кадра из useFrame. Не дергает React каждый кадр. */
export const tickFrame = (deltaMs: number): void => {
  frameCount += 1;
  accumulatedMs += deltaMs;

  const now = performance.now();
  if (lastSampleAt === 0) {
    lastSampleAt = now;
    return;
  }

  const elapsed = now - lastSampleAt;
  if (elapsed < 250) {
    return;
  }

  snapshot = {
    fps: Math.round((frameCount * 1000) / elapsed),
    ms: Math.round((accumulatedMs / frameCount) * 10) / 10,
  };
  frameCount = 0;
  accumulatedMs = 0;
  lastSampleAt = now;
  emit();
};

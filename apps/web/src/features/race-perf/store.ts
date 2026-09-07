export type RacePerfSnapshot = {
  fps: number;
  cpuPercent: number;
  memMb: number | null;
};

type Listener = () => void;

type PerformanceMemory = {
  usedJSHeapSize: number;
};

let snapshot: RacePerfSnapshot = { fps: 0, cpuPercent: 0, memMb: null };
let frameCount = 0;
let accumulatedWorkMs = 0;
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

/** Получить используемую память в МБ */
const readMemMb = (): number | null => {
  const memory = (performance as Performance & { memory?: PerformanceMemory }).memory;
  if (!memory) {
    return null;
  }
  return Math.round(memory.usedJSHeapSize / (1024 * 1024));
};

const emit = (): void => {
  const now = performance.now();
  if (now - lastNotifyAt < 250) {
    return;
  }
  lastNotifyAt = now;
  listeners.forEach((listener) => listener());
};

/** Тик кадра из FramePerfTracker (work time кадра). Не дергает React каждый кадр. */
export const tickFrame = (workMs: number): void => {
  frameCount += 1;
  accumulatedWorkMs += workMs;

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
    cpuPercent: Math.min(100, Math.max(0, Math.round((accumulatedWorkMs / elapsed) * 100))),
    memMb: readMemMb(),
  };
  frameCount = 0;
  accumulatedWorkMs = 0;
  lastSampleAt = now;
  emit();
};

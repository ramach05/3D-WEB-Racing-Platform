import type { TRacePerfSnapshot } from './store.types';

type TListener = () => void;

type TPerformanceMemory = {
  /** Used JS heap, bytes */
  usedJSHeapSize: number;
};

let snapshot: TRacePerfSnapshot = { fps: 0, cpuPercent: 0, memMb: null };
let frameCount = 0;
let accumulatedWorkMs = 0;
let lastSampleAt = 0;
let lastNotifyAt = 0;
const listeners = new Set<TListener>();

/** HUD subscription to the performance snapshot */
export const subscribeRacePerf = (listener: TListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Current performance snapshot */
export const getRacePerfSnapshot = (): TRacePerfSnapshot => snapshot;

/** Get used memory in MB */
const readMemMb = (): number | null => {
  const memory = (performance as Performance & { memory?: TPerformanceMemory }).memory;
  if (!memory) {
    return null;
  }
  return Math.round(memory.usedJSHeapSize / (1024 * 1024));
};

/** Notifies perf HUD subscribers at most every ~250 ms */
const emit = (): void => {
  const now = performance.now();
  if (now - lastNotifyAt < 250) {
    return;
  }
  lastNotifyAt = now;
  listeners.forEach((listener) => listener());
};

/** Frame tick from FramePerfTracker (frame work time). Does not poke React every frame. */
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

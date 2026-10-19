import type { TCountdownStep, TRaceHudSnapshot } from './store.types';

/** Lap count on every track */
export const RACE_LAP_TOTAL = 3;

type TListener = () => void;

const BEST_PREFIX = 'racing-best:';

let snapshot: TRaceHudSnapshot = {
  timeMs: 0,
  bestMs: null,
  status: 'ready',
  countdownStep: null,
  speedKmh: 0,
  checkpointIndex: 0,
  checkpointTotal: 4,
  lapIndex: 0,
  lapTotal: RACE_LAP_TOTAL,
};

let startedAt = 0;
let pausedAccumulated = 0;
let pauseStartedAt = 0;
let lastNotifyAt = 0;
const listeners = new Set<TListener>();
let notifyScheduled = false;

/** Reads the guest's best time for this track */
export const readGuestBest = (trackId: string): number | null => {
  const raw = localStorage.getItem(`${BEST_PREFIX}${trackId}`);
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

/** Stores the guest's best time */
export const writeGuestBest = (trackId: string, timeMs: number): void => {
  const current = readGuestBest(trackId);
  if (current === null || timeMs < current) {
    localStorage.setItem(`${BEST_PREFIX}${trackId}`, String(timeMs));
  }
};

/** HUD subscription to the race snapshot */
export const subscribeRaceHud = (listener: TListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Current HUD snapshot */
export const getRaceHudSnapshot = (): TRaceHudSnapshot => snapshot;

/** Notifies subscribers outside the current frame: HUD React renders must not steal a frame from scene rendering */
const flushListeners = (): void => {
  if (!notifyScheduled) {
    return;
  }
  notifyScheduled = false;
  lastNotifyAt = performance.now();
  listeners.forEach((listener) => listener());
};

/** Batches the notification into the next rAF; a burst of emits collapses into one. setTimeout is a safety net for places where rAF does not run (background tab, jsdom timers). */
const scheduleNotify = (): void => {
  if (notifyScheduled) {
    return;
  }
  notifyScheduled = true;
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(flushListeners);
  }
  setTimeout(flushListeners, 32);
};

/** Notifies HUD subscribers; without force — at most once per ~80 ms */
const emit = (force: boolean): void => {
  const now = performance.now();
  if (!force && now - lastNotifyAt < 80) {
    return;
  }
  scheduleNotify();
};

/** Patches the HUD snapshot and emits */
const setSnapshot = (patch: Partial<TRaceHudSnapshot>, force = false): void => {
  snapshot = { ...snapshot, ...patch };
  emit(force);
};

/** Prepares the race for the start (countdown / ready) */
export const resetRaceSession = (
  trackId: string,
  checkpointTotal: number,
  lapTotal: number = RACE_LAP_TOTAL,
): void => {
  startedAt = 0;
  pausedAccumulated = 0;
  pauseStartedAt = 0;
  setSnapshot(
    {
      timeMs: 0,
      bestMs: readGuestBest(trackId),
      status: 'ready',
      countdownStep: null,
      speedKmh: 0,
      checkpointIndex: 0,
      checkpointTotal,
      lapIndex: 0,
      lapTotal,
    },
    true,
  );
};

/** After touching down: 3-2-1-GO before the timer starts */
export const beginCountdown = (): void => {
  if (snapshot.status !== 'ready') {
    return;
  }
  setSnapshot({ status: 'countdown', countdownStep: 3 }, true);
};

/** Updates the digit/GO on the overlay and the start lights */
export const setCountdownStep = (step: TCountdownStep): void => {
  if (snapshot.status !== 'countdown') {
    return;
  }
  setSnapshot({ countdownStep: step }, true);
};

/** Starts the timer after the countdown */
export const startRacing = (): void => {
  startedAt = performance.now();
  pausedAccumulated = 0;
  setSnapshot({ status: 'racing', timeMs: 0, countdownStep: null }, true);
};

/** Pause: physics is stopped externally */
export const pauseRace = (): void => {
  if (snapshot.status !== 'racing') {
    return;
  }
  pauseStartedAt = performance.now();
  setSnapshot({ status: 'paused' }, true);
};

/** Resumes a paused race */
export const resumeRace = (): void => {
  if (snapshot.status !== 'paused') {
    return;
  }
  pausedAccumulated += performance.now() - pauseStartedAt;
  setSnapshot({ status: 'racing' }, true);
};

/** Toggles the pause */
export const togglePause = (): void => {
  if (snapshot.status === 'racing') {
    pauseRace();
    return;
  }
  if (snapshot.status === 'paused') {
    resumeRace();
  }
};

/** Timer and speed tick from useFrame. Writes into snapshot without a React emit (HUD reads via rAF). */
export const tickRace = (speedKmh: number): void => {
  if (snapshot.status !== 'racing' || startedAt === 0) {
    snapshot.speedKmh = speedKmh;
    return;
  }
  snapshot.timeMs = Math.round(performance.now() - startedAt - pausedAccumulated);
  snapshot.speedKmh = speedKmh;
};

/** Counts a completed lap (crossing the finish line with enough progress). Returns true when all race laps are done. */
export const registerLapComplete = (): boolean => {
  if (snapshot.status !== 'racing') {
    return false;
  }

  const nextLap = snapshot.lapIndex + 1;
  if (nextLap < snapshot.lapTotal) {
    setSnapshot({ lapIndex: nextLap }, true);
    return false;
  }

  setSnapshot({ lapIndex: snapshot.lapTotal }, true);
  return true;
};

/**
 * Checkpoint in order within the current lap.
 * Returns true only when all laps are completed (race finish).
 * @deprecated Used only in unit tests; the game counts laps via registerLapComplete.
 */
export const registerCheckpoint = (index: number): boolean => {
  if (snapshot.status !== 'racing') {
    return false;
  }
  if (index !== snapshot.checkpointIndex) {
    return false;
  }
  const next = index + 1;
  if (next < snapshot.checkpointTotal) {
    setSnapshot({ checkpointIndex: next }, true);
    return false;
  }

  const nextLap = snapshot.lapIndex + 1;
  if (nextLap < snapshot.lapTotal) {
    setSnapshot({ checkpointIndex: 0, lapIndex: nextLap }, true);
    return false;
  }

  setSnapshot(
    {
      checkpointIndex: snapshot.checkpointTotal,
      lapIndex: snapshot.lapTotal,
    },
    true,
  );
  return true;
};

/** Finish: records the final time and the guest's best */
export const finishRace = (trackId: string): number => {
  const timeMs = Math.round(
    snapshot.status === 'racing' && startedAt !== 0
      ? performance.now() - startedAt - pausedAccumulated
      : snapshot.timeMs,
  );
  writeGuestBest(trackId, timeMs);
  setSnapshot(
    {
      status: 'finished',
      timeMs,
      bestMs: readGuestBest(trackId),
    },
    true,
  );
  return timeMs;
};

/** Forced finish for e2e (no driving) */
export const finishRaceForTest = (trackId: string, timeMs: number): number => {
  writeGuestBest(trackId, timeMs);
  setSnapshot(
    {
      status: 'finished',
      timeMs,
      bestMs: readGuestBest(trackId),
      checkpointIndex: snapshot.checkpointTotal,
      lapIndex: snapshot.lapTotal,
    },
    true,
  );
  return timeMs;
};

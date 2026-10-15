import type { TCountdownStep, TRaceHudSnapshot } from './store.types';

/** Число кругов на любой трассе */
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

/** Читает лучшее время гостя с этой трассы */
export const readGuestBest = (trackId: string): number | null => {
  const raw = localStorage.getItem(`${BEST_PREFIX}${trackId}`);
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

/** Пишет лучшее время гостя */
export const writeGuestBest = (trackId: string, timeMs: number): void => {
  const current = readGuestBest(trackId);
  if (current === null || timeMs < current) {
    localStorage.setItem(`${BEST_PREFIX}${trackId}`, String(timeMs));
  }
};

/** Подписка HUD на снимок заезда */
export const subscribeRaceHud = (listener: TListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Текущий снимок HUD */
export const getRaceHudSnapshot = (): TRaceHudSnapshot => snapshot;

/** Уведомляет подписчиков вне текущего кадра: React-рендеры HUD не должны вырывать кадр у отрисовки сцены */
const flushListeners = (): void => {
  if (!notifyScheduled) {
    return;
  }
  notifyScheduled = false;
  lastNotifyAt = performance.now();
  listeners.forEach((listener) => listener());
};

/**
 * Ставит уведомление на ближайший rAF; серия emit'ов схлопывается в один.
 * setTimeout — страховка на случай, где rAF не крутится (фоновая вкладка, jsdom-таймеры).
 */
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

/** Уведомляет подписчиков HUD; без force — не чаще ~80 мс */
const emit = (force: boolean): void => {
  const now = performance.now();
  if (!force && now - lastNotifyAt < 80) {
    return;
  }
  scheduleNotify();
};

/** Патчит снимок HUD и шлёт emit */
const setSnapshot = (patch: Partial<TRaceHudSnapshot>, force = false): void => {
  snapshot = { ...snapshot, ...patch };
  emit(force);
};

/** Готовит заезд к старту (countdown / ready) */
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

/** После касания земли: 3-2-1-GO перед стартом таймера */
export const beginCountdown = (): void => {
  if (snapshot.status !== 'ready') {
    return;
  }
  setSnapshot({ status: 'countdown', countdownStep: 3 }, true);
};

/** Обновляет цифру/GO на оверлее и стартовых огнях */
export const setCountdownStep = (step: TCountdownStep): void => {
  if (snapshot.status !== 'countdown') {
    return;
  }
  setSnapshot({ countdownStep: step }, true);
};

/** Старт таймера после countdown */
export const startRacing = (): void => {
  startedAt = performance.now();
  pausedAccumulated = 0;
  setSnapshot({ status: 'racing', timeMs: 0, countdownStep: null }, true);
};

/** Пауза: физика останавливается снаружи */
export const pauseRace = (): void => {
  if (snapshot.status !== 'racing') {
    return;
  }
  pauseStartedAt = performance.now();
  setSnapshot({ status: 'paused' }, true);
};

/** Снятие паузы */
export const resumeRace = (): void => {
  if (snapshot.status !== 'paused') {
    return;
  }
  pausedAccumulated += performance.now() - pauseStartedAt;
  setSnapshot({ status: 'racing' }, true);
};

/** Переключает паузу */
export const togglePause = (): void => {
  if (snapshot.status === 'racing') {
    pauseRace();
    return;
  }
  if (snapshot.status === 'paused') {
    resumeRace();
  }
};

/** Тик таймера и скорости из useFrame. Пишет в snapshot без React emit (HUD читает через rAF). */
export const tickRace = (speedKmh: number): void => {
  if (snapshot.status !== 'racing' || startedAt === 0) {
    snapshot.speedKmh = speedKmh;
    return;
  }
  snapshot.timeMs = Math.round(performance.now() - startedAt - pausedAccumulated);
  snapshot.speedKmh = speedKmh;
};

/**
 * Засчитывает завершённый круг (пересечение финишной линии после достаточного прогресса).
 * Возвращает true, когда пройдены все круги заезда.
 */
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
 * Чекпоинт по порядку внутри текущего круга.
 * Возвращает true только когда пройдены все круги (финиш заезда).
 * @deprecated Используется только в unit-тестах; в игре круги считает registerLapComplete.
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

/** Финиш: фиксирует время и best для гостя */
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

/** Принудительный финиш для e2e (без вождения) */
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

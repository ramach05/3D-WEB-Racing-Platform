import type { TLoopPoint } from './config.types';
import type { TTrackProgress } from './track-progress.types';

/** Ближайшая точка на центральной линии и доля вдоль индекса точек (0…1, рост с индексом). */
export const getTrackProgress = (
  x: number,
  z: number,
  centerline: TLoopPoint[],
): TTrackProgress => {
  if (centerline.length === 0) {
    return { segmentIndex: 0, segmentT: 0, ratio: 0 };
  }

  let bestDistSq = Infinity;
  let bestIndex = 0;
  let bestT = 0;

  for (let i = 0; i < centerline.length; i += 1) {
    const a = centerline[i];
    const b = centerline[(i + 1) % centerline.length];
    if (!a || !b) {
      continue;
    }

    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lenSq = dx * dx + dz * dz;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lenSq));
    const px = a.x + dx * t;
    const pz = a.z + dz * t;
    const distSq = (x - px) ** 2 + (z - pz) ** 2;

    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestIndex = i;
      bestT = t;
    }
  }

  return {
    segmentIndex: bestIndex,
    segmentT: bestT,
    ratio: (bestIndex + bestT) / centerline.length,
  };
};

/** Обновляет максимальный прогресс круга с учётом перехода через старт (0/1). */
export const advanceLapProgress = (currentMax: number, ratio: number): number => {
  if (ratio > currentMax && ratio - currentMax < 0.5) {
    return ratio;
  }
  return currentMax;
};

/**
 * Накапливает пройденную долю круга в направлении заезда.
 * Заезд = убывающий centerline `ratio` (см. `race-direction.ts`).
 * Скачки ≥ 0.5 не добавляют travel, но lastRatio обновляется.
 */
export const accumulateLapTravel = (
  lapTravel: number,
  lastRatio: number | null,
  ratio: number,
): { lapTravel: number; lastRatio: number } => {
  if (lastRatio === null) {
    return { lapTravel, lastRatio: ratio };
  }
  const raceStep = (lastRatio - ratio + 1) % 1;
  if (raceStep > 0 && raceStep < 0.5) {
    return { lapTravel: lapTravel + raceStep, lastRatio: ratio };
  }
  return { lapTravel, lastRatio: ratio };
};

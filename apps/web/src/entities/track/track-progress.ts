import type { TLoopPoint } from './config';

export type TTrackProgress = {
  segmentIndex: number;
  segmentT: number;
  /** Позиция на круге: 0..1 */
  ratio: number;
};

/** Ближайшая точка на центральной линии и доля пройденного круга */
export const getTrackProgress = (x: number, z: number, centerline: TLoopPoint[]): TTrackProgress => {
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

import type { CheckpointLocalCoords, OrientedBox } from '@/entities/track';
import { isInsideCheckpoint } from '@/entities/track';

type Vec2 = {
  x: number;
  z: number;
};

/** Минимальная доля круга до засчёта финишной линии (анти-ложный старт). */
export const MIN_LAP_PROGRESS = 0.55;

/** Зона у старт/финиш — игнорируем повторные срабатывания сразу после зачёта круга. */
export const START_FINISH_COOLDOWN_RATIO = 0.14;

/** Локальные координаты линии: lx — поперёк, lz — вдоль трассы. */
export const getTrackLineLocalCoords = (
  x: number,
  z: number,
  line: OrientedBox,
): CheckpointLocalCoords => {
  const dx = x - line.position[0];
  const dz = z - line.position[2];
  const sin = Math.sin(line.rotationY);
  const cos = Math.cos(line.rotationY);
  return {
    lx: dx * cos - dz * sin,
    lz: dx * sin + dz * cos,
  };
};

/** Проезд через зону чекпоинта с учётом перемещения между кадрами. */
export const passedCheckpointZone = (
  prevX: number | null,
  prevZ: number | null,
  x: number,
  z: number,
  checkpoint: OrientedBox,
): boolean => {
  if (isInsideCheckpoint(x, z, checkpoint)) {
    return true;
  }
  if (prevX === null || prevZ === null) {
    return false;
  }
  if (isInsideCheckpoint(prevX, prevZ, checkpoint)) {
    return true;
  }
  const steps = 12;
  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const sampleX = prevX + (x - prevX) * t;
    const sampleZ = prevZ + (z - prevZ) * t;
    if (isInsideCheckpoint(sampleX, sampleZ, checkpoint)) {
      return true;
    }
  }
  return false;
};

const segmentsIntersect = (a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean => {
  const denom = (b.x - a.x) * (d.z - c.z) - (b.z - a.z) * (d.x - c.x);
  if (Math.abs(denom) < 1e-9) {
    return false;
  }
  const t = ((c.x - a.x) * (d.z - c.z) - (c.z - a.z) * (d.x - c.x)) / denom;
  const u = ((c.x - a.x) * (b.z - a.z) - (c.z - a.z) * (b.x - a.x)) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
};

/** Пересечение траектории машины с отрезком линии финиша. */
export const crossedFinishLine = (
  prevX: number,
  prevZ: number,
  x: number,
  z: number,
  line: OrientedBox,
): boolean => {
  const halfWidth = line.size[0] / 2;
  const acrossX = Math.cos(line.rotationY);
  const acrossZ = -Math.sin(line.rotationY);
  const cx = line.position[0];
  const cz = line.position[2];

  const lineStart = {
    x: cx - acrossX * halfWidth,
    z: cz - acrossZ * halfWidth,
  };
  const lineEnd = {
    x: cx + acrossX * halfWidth,
    z: cz + acrossZ * halfWidth,
  };

  return segmentsIntersect({ x: prevX, z: prevZ }, { x, z }, lineStart, lineEnd);
};

/** Пересечение линии финиша с учётом перемещения между кадрами. */
export const passedFinishLine = (
  prevX: number | null,
  prevZ: number | null,
  x: number,
  z: number,
  line: OrientedBox,
): boolean => {
  if (prevX === null || prevZ === null) {
    return false;
  }
  if (crossedFinishLine(prevX, prevZ, x, z, line)) {
    return true;
  }
  const steps = 12;
  let segmentStartX = prevX;
  let segmentStartZ = prevZ;
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const sampleX = prevX + (x - prevX) * t;
    const sampleZ = prevZ + (z - prevZ) * t;
    if (crossedFinishLine(segmentStartX, segmentStartZ, sampleX, sampleZ, line)) {
      return true;
    }
    segmentStartX = sampleX;
    segmentStartZ = sampleZ;
  }
  return false;
};

/** Можно ли засчитать пересечение финиша как завершение круга. */
export const canRegisterLapCrossing = (
  crossed: boolean,
  inCooldown: boolean,
  maxProgress: number,
): boolean => {
  return crossed && !inCooldown && maxProgress >= MIN_LAP_PROGRESS;
};

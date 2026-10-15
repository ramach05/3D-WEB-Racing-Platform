import type { TOrientedBox } from './config.types';
import type { TCheckpointLocalCoords } from './oriented-box.types';

/** Локальные координаты чекпоинта (совпадают с ориентацией зоны детекции). */
export const getCheckpointLocalCoords = (
  x: number,
  z: number,
  checkpoint: TOrientedBox,
): TCheckpointLocalCoords => {
  const dx = x - checkpoint.position[0];
  const dz = z - checkpoint.position[2];
  const sin = Math.sin(-checkpoint.rotationY);
  const cos = Math.cos(-checkpoint.rotationY);
  return {
    lx: dx * cos - dz * sin,
    lz: dx * sin + dz * cos,
  };
};

/** Проверяет, находится ли точка внутри ориентированного чекпоинта (XZ). */
export const isInsideCheckpoint = (x: number, z: number, checkpoint: TOrientedBox): boolean => {
  const { lx, lz } = getCheckpointLocalCoords(x, z, checkpoint);
  return Math.abs(lx) <= checkpoint.size[0] / 2 && Math.abs(lz) <= checkpoint.size[2] / 2;
};

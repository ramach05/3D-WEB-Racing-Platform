import type { TTrackConfig } from './config.types';

export type TTreeKind = 'pine' | 'broadleaf';

export type TPlacedTree = {
  /** Мировая X */
  x: number;
  /** Мировая Z */
  z: number;
  /** Масштаб дерева */
  scale: number;
  /** Поворот вокруг Y (рад) */
  rotationY: number;
  /** Вид кроны */
  kind: TTreeKind;
};

export type TPlaceTrackTreesOptions = {
  /** Конфиг трассы */
  config: TTrackConfig;
  /** Лимит деревьев */
  maxTrees?: number;
};

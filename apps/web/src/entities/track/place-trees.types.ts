import type { TTrackConfig } from './config.types';

export type TTreeKind = 'pine' | 'broadleaf';

export type TPlacedTree = {
  x: number;
  z: number;
  scale: number;
  rotationY: number;
  kind: TTreeKind;
};

export type TPlaceTrackTreesOptions = {
  config: TTrackConfig;
  maxTrees?: number;
};

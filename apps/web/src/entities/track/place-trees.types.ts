import type { TTrackConfig } from './config.types';

export type TTreeKind = 'pine' | 'broadleaf';

export type TPlacedTree = {
  /** World X */
  x: number;
  /** World Z */
  z: number;
  /** Base height above the track plane (terrain) */
  groundY: number;
  /** Tree scale */
  scale: number;
  /** Rotation around Y (rad) */
  rotationY: number;
  /** Canopy kind */
  kind: TTreeKind;
};

export type TPlaceTrackTreesOptions = {
  /** Track config */
  config: TTrackConfig;
  /** Tree limit */
  maxTrees?: number;
  /** Ground height at (x,z); defaults to 0 */
  sampleGroundY?: (x: number, z: number) => number;
};

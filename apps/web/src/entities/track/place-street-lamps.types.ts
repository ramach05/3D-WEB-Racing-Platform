import type { TTrackConfig } from './config.types';

export type TPlacedStreetLamp = {
  /** World X */
  x: number;
  /** World Z */
  z: number;
  /** Rotation around Y (rad): local +X of the bracket faces the road. */
  rotationY: number;
  /** +1 — outer stadium side, −1 — inner */
  sideSign: 1 | -1;
};

export type TPlaceStreetLampsOptions = {
  /** Track config */
  config: TTrackConfig;
  /** Spacing along the centerline (m) */
  spacing?: number;
};

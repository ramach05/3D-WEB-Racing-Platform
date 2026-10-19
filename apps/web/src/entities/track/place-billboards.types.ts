import type { TTrackConfig } from './config.types';

/** Ad layout identifiers on the billboards */
export const BILLBOARD_AD_IDS = [
  'torque-cola',
  'apex-tires',
  'nitro-donuts',
  'pitstop-insurance',
  'for-rent',
] as const;

export type TBillboardAdId = (typeof BILLBOARD_AD_IDS)[number];

export type TPlacedBillboard = {
  /** World X */
  x: number;
  /** World Z */
  z: number;
  /** Rotation around Y (rad): local +X is the panel normal along the centerline tangent (index growth), facing the oncoming race. Independent of the track side. */
  rotationY: number;
  /** +1 — outer stadium side, −1 — inner */
  sideSign: 1 | -1;
  /** Ad layout on the panel */
  adId: TBillboardAdId;
};

export type TPlaceBillboardsOptions = {
  /** Track config */
  config: TTrackConfig;
  /** Target number of billboards (default 5) */
  targetCount?: number;
};

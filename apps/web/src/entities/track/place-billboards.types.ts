import type { TTrackConfig } from './config.types';

/** Идентификаторы рекламных макетов на щитах */
export const BILLBOARD_AD_IDS = [
  'torque-cola',
  'apex-tires',
  'nitro-donuts',
  'pitstop-insurance',
  'for-rent',
] as const;

export type TBillboardAdId = (typeof BILLBOARD_AD_IDS)[number];

export type TPlacedBillboard = {
  /** Мировая X */
  x: number;
  /** Мировая Z */
  z: number;
  /**
   * Поворот вокруг Y (рад): локальная +X — нормаль панели вдоль касательной
   * centerline (рост индекса), лицом навстречу заезду. Не зависит от стороны трассы.
   */
  rotationY: number;
  /** +1 — внешняя сторона стадиона, −1 — внутренняя */
  sideSign: 1 | -1;
  /** Макет рекламы на панели */
  adId: TBillboardAdId;
};

export type TPlaceBillboardsOptions = {
  /** Конфиг трассы */
  config: TTrackConfig;
  /** Целевое число щитов (по умолчанию 5) */
  targetCount?: number;
};

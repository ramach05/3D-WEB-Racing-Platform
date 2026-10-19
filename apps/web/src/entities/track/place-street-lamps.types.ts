import type { TTrackConfig } from './config.types';

export type TPlacedStreetLamp = {
  /** Мировая X */
  x: number;
  /** Мировая Z */
  z: number;
  /** Поворот вокруг Y (рад): локальная +X кронштейна смотрит на дорогу. */
  rotationY: number;
  /** +1 — внешняя сторона стадиона, −1 — внутренняя */
  sideSign: 1 | -1;
};

export type TPlaceStreetLampsOptions = {
  /** Конфиг трассы */
  config: TTrackConfig;
  /** Шаг вдоль centerline (м) */
  spacing?: number;
};

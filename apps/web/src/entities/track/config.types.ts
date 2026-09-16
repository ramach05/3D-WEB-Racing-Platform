import type { TTrackSlug } from '@racing/shared';
import type { TCarSkinColors, TTrackPaletteColors } from '@/shared/config';

export type TVec3 = readonly [number, number, number];

export type TOrientedBox = {
  /** Центр бокса */
  position: TVec3;
  /** Габариты [x, y, z] */
  size: TVec3;
  /** Поворот вокруг Y (рад) */
  rotationY: number;
};

export type TObstacleKind = 'tireStack' | 'fuelBarrel';

export type TTrackObstacle = TOrientedBox & {
  /** Тип препятствия */
  kind: TObstacleKind;
};

export type TLoopPoint = {
  /** X на плоскости трассы */
  x: number;
  /** Z на плоскости трассы */
  z: number;
};

/** Палитра материалов трассы — значения из shared/config trackPalettes */
export type TTrackPalette = TTrackPaletteColors;

/** Окраска машины — значения из shared/config carSkins */
export type TCarSkin = TCarSkinColors;

export type TTrackAudioTheme = 'coastal' | 'night';

export type TTimeOfDay = 'day' | 'night';

/** Сторона трибун относительно направления движения (left = внешняя сторона трассы) */
export type TStartTribuneSide = 'left' | 'right';

export type TTrackConfig = {
  /** Идентификатор трассы */
  slug: TTrackSlug;
  /** Точка спавна машины (на стороне финиша lz > 0) */
  spawnPosition: TVec3;
  /**
   * Угол носа на старте / респавне (рад).
   * Направление заезда — против роста индекса centerline; см. `race-direction.ts`.
   */
  spawnRotationY: number;
  /** Линия старт/финиш */
  startFinishLine: TOrientedBox;
  /** Стены трассы */
  walls: TOrientedBox[];
  /** Чекпоинты (legacy / запас) */
  checkpoints: TOrientedBox[];
  /** Динамические препятствия */
  obstacles: TTrackObstacle[];
  /** Лужи масла на асфальте (зоны потери сцепления) */
  oilSlicks: TOrientedBox[];
  /** Центровая линия: ratio растёт с индексом; заезд идёт против роста — см. `race-direction.ts` */
  centerline: TLoopPoint[];
  /** Ширина дороги */
  roadWidth: number;
  /** Палитра материалов */
  palette: TTrackPalette;
  /** Окраска машины */
  carSkin: TCarSkin;
  /** Тема чиптюна */
  audioTheme: TTrackAudioTheme;
  /** День или ночь */
  timeOfDay: TTimeOfDay;
  /** Сторона трибун у старта */
  startTribuneSide: TStartTribuneSide;
  /** Зоны, где деревья нельзя размещать (трибуны и т.п.) */
  treeExclusionZones: TOrientedBox[];
};

export type TBuildLoopOptions = {
  /** Идентификатор трассы */
  slug: TTrackSlug;
  /** Точки петли centerline */
  points: TLoopPoint[];
  /** Ширина дороги */
  roadWidth: number;
  /** Палитра */
  palette: TTrackPalette;
  /** Окраска машины */
  carSkin: TCarSkin;
  /** Тема аудио */
  audioTheme: TTrackAudioTheme;
  /** Метры от линии финиша вдоль centerline (сторона +lz) */
  spawnOffsetMeters: number;
  /** Сторона трибун */
  startTribuneSide: TStartTribuneSide;
};

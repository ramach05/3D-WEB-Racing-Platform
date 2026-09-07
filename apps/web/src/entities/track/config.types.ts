import type { TTrackSlug } from '@racing/shared';
import type { TCarSkinColors, TTrackPaletteColors } from '@/shared/config';

export type TVec3 = readonly [number, number, number];

export type TOrientedBox = {
  position: TVec3;
  size: TVec3;
  rotationY: number;
};

export type TObstacleKind = 'tireStack';

export type TTrackObstacle = TOrientedBox & { kind: TObstacleKind };

export type TLoopPoint = {
  x: number;
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
  slug: TTrackSlug;
  spawnPosition: TVec3;
  spawnRotationY: number;
  startFinishLine: TOrientedBox;
  segments: TOrientedBox[];
  walls: TOrientedBox[];
  checkpoints: TOrientedBox[];
  obstacles: TTrackObstacle[];
  centerline: TLoopPoint[];
  roadWidth: number;
  palette: TTrackPalette;
  carSkin: TCarSkin;
  audioTheme: TTrackAudioTheme;
  timeOfDay: TTimeOfDay;
  startTribuneSide: TStartTribuneSide;
  /** Зоны, где деревья нельзя размещать (трибуны и т.п.) */
  treeExclusionZones: TOrientedBox[];
};

export type TBuildLoopOptions = {
  slug: TTrackSlug;
  points: TLoopPoint[];
  roadWidth: number;
  palette: TTrackPalette;
  carSkin: TCarSkin;
  audioTheme: TTrackAudioTheme;
  spawnRatio: number;
  startTribuneSide: TStartTribuneSide;
};

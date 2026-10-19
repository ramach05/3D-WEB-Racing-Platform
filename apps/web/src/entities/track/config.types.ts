import type { TTrackSlug } from '@racing/shared';
import type { TCarSkinColors, TTrackPaletteColors } from '@/shared/config';

export type TTrackWeather = 'clear' | 'rain';

export type TVec3 = readonly [number, number, number];

export type TOrientedBox = {
  /** Box center */
  position: TVec3;
  /** Dimensions [x, y, z] */
  size: TVec3;
  /** Rotation around Y (rad) */
  rotationY: number;
};

export type TObstacleKind = 'tireStack' | 'fuelBarrel';

export type TTrackObstacle = TOrientedBox & {
  /** Obstacle type */
  kind: TObstacleKind;
};

export type TLoopPoint = {
  /** X on the track plane */
  x: number;
  /** Z on the track plane */
  z: number;
  /** Height above the track plane (optional; defaults to y=0) */
  y?: number;
};

/** Track material palette — values from shared/config trackPalettes */
export type TTrackPalette = TTrackPaletteColors;

/** Car paint — values from shared/config carSkins */
export type TCarSkin = TCarSkinColors;

export type TTrackAudioTheme = 'coastal' | 'night' | 'rock';

export type TTimeOfDay = 'day' | 'night';

/** Grandstand side relative to the race direction (left = car's left; the race runs against centerline index growth) */
export type TStartTribuneSide = 'left' | 'right';

export type TTrackConfig = {
  /** Track identifier */
  slug: TTrackSlug;
  /** Car spawn point (on the finish side lz > 0) */
  spawnPosition: TVec3;
  /** Nose angle at start / respawn (rad). The race direction is against centerline index growth; see `race-direction.ts`. */
  spawnRotationY: number;
  /** Start/finish line */
  startFinishLine: TOrientedBox;
  /** Track walls */
  walls: TOrientedBox[];
  /** Checkpoints (legacy / fallback) */
  checkpoints: TOrientedBox[];
  /** Dynamic obstacles */
  obstacles: TTrackObstacle[];
  /** Oil slicks on the asphalt (grip-loss zones) */
  oilSlicks: TOrientedBox[];
  /** Centerline: ratio grows with index; the race runs against index growth — see `race-direction.ts` */
  centerline: TLoopPoint[];
  /** Road width */
  roadWidth: number;
  /** Material palette */
  palette: TTrackPalette;
  /** Car paint */
  carSkin: TCarSkin;
  /** Chiptune theme */
  audioTheme: TTrackAudioTheme;
  /** Day or night */
  timeOfDay: TTimeOfDay;
  /** Grandstand side at the start */
  startTribuneSide: TStartTribuneSide;
  /** Zones where trees must not be placed (grandstands etc.) */
  treeExclusionZones: TOrientedBox[];
  /** Height of each centerline point (optional); defaults to y=0 */
  centerlineY?: number[];
  /** Road widths per centerline point (optional); defaults to roadWidth */
  roadWidths?: number[];
  /** Wall exclusion window: [ratioStart, ratioEnd] — segments between these ratios draw no walls */
  wallExclusionWindows?: [number, number][];
  /** Elevated-deck piers (visual pylons under the bridge) */
  piers?: TOrientedBox[];
  /** Track weather */
  weather?: TTrackWeather;
};

export type TBuildLoopOptions = {
  /** Track identifier */
  slug: TTrackSlug;
  /** Centerline loop points */
  points: TLoopPoint[];
  /** Road width */
  roadWidth: number;
  /** Palette */
  palette: TTrackPalette;
  /** Car paint */
  carSkin: TCarSkin;
  /** Audio theme */
  audioTheme: TTrackAudioTheme;
  /** Meters from the finish line along the centerline (+lz side) */
  spawnOffsetMeters: number;
  /** Grandstand side */
  startTribuneSide: TStartTribuneSide;
  /** Wall exclusion window: [ratioStart, ratioEnd] */
  wallExclusionWindows?: [number, number][];
  /** Height of each centerline point (optional) */
  centerlineY?: number[];
  /** Track weather */
  weather?: TTrackWeather;
};

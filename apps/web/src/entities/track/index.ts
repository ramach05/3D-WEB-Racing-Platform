export type { TTrackPublic, TTrackSlug } from '@racing/shared';
export { TRACK_SLUGS, TRACK_SLUG_COASTAL_OVAL, TRACK_SLUG_NIGHT_CITY } from '@racing/shared';
export { trackApi, useGetTracksQuery } from './api';
export type {
  TCarSkin,
  TObstacleKind,
  TOrientedBox,
  TLoopPoint,
  TStartTribuneSide,
  TTrackAudioTheme,
  TTimeOfDay,
  TTrackConfig,
  TTrackObstacle,
  TTrackPalette,
  TVec3,
} from './config.types';
export { coastalOvalTrack, getAllTrackConfigs, getTrackConfig, nightCityTrack } from './config';
export { getCheckpointLocalCoords, isInsideCheckpoint } from './oriented-box';
export type { TCheckpointLocalCoords } from './oriented-box.types';
export { placeTrackTrees, TREE_PLACEMENT_LIMITS } from './place-trees';
export type { TPlacedTree, TTreeKind } from './place-trees.types';
export {
  ROW_DEPTH,
  ROW_HEIGHT,
  SECTION_PITCH,
  SECTION_WIDTH,
  SECTION_Z_OFFSETS,
  TRIBUNE_MARGIN,
  TRIBUNE_ROWS,
  WALL_OFFSET,
  buildTribuneTreeExclusionZone,
} from './tribune-layout';
export { accumulateLapTravel, advanceLapProgress, getTrackProgress } from './track-progress';
export type { TTrackProgress } from './track-progress.types';

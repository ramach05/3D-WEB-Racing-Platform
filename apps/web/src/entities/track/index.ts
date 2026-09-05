export type { TrackPublic, TrackSlug } from '@racing/shared';
export { TRACK_SLUGS, TRACK_SLUG_COASTAL_OVAL, TRACK_SLUG_NIGHT_CITY } from '@racing/shared';
export { trackApi, useGetTracksQuery } from './api';
export type {
  CarSkin,
  ObstacleKind,
  OrientedBox,
  StartTribuneSide,
  TrackAudioTheme,
  TimeOfDay,
  TrackConfig,
  TrackObstacle,
  TrackPalette,
  Vec3,
} from './config';
export { coastalOvalTrack, getAllTrackConfigs, getTrackConfig, nightCityTrack } from './config';
export { getCheckpointLocalCoords, isInsideCheckpoint } from './oriented-box';
export type { CheckpointLocalCoords } from './oriented-box';
export { advanceLapProgress, getTrackProgress } from './track-progress';
export type { TrackProgress } from './track-progress';

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
export { placeStreetLamps, STREET_LAMP_PLACEMENT } from './place-street-lamps';
export type { TPlacedStreetLamp } from './place-street-lamps.types';
export { placeBillboards, BILLBOARD_PLACEMENT } from './place-billboards';
export { BILLBOARD_AD_IDS } from './place-billboards.types';
export type {
  TBillboardAdId,
  TPlacedBillboard,
  TPlaceBillboardsOptions,
} from './place-billboards.types';
export {
  CANOPY_CENTER_Y_OFFSET,
  CANOPY_POST_SIZE,
  CANOPY_POSTS_PER_SECTION,
  CANOPY_THICKNESS,
  FASCIA_HEIGHT,
  FASCIA_THICKNESS,
  FOUNDATION_OVERHANG,
  FOUNDATION_THICKNESS,
  RAIL_HEIGHT,
  RAIL_POST_SPACING,
  RAIL_TUBE,
  ROW_DEPTH,
  ROW_HEIGHT,
  SEAT_BACK_HEIGHT,
  SEAT_BACK_THICKNESS,
  SEAT_PLANK_DEPTH,
  SEAT_PLANK_HEIGHT,
  SECTION_PITCH,
  SECTION_WIDTH,
  SECTION_Z_OFFSETS,
  STAIR_CURB_HEIGHT,
  STAIR_CURB_THICKNESS,
  STAIR_GAP,
  STAIR_RUN,
  STAIR_WIDTH,
  TREE_EXCLUSION_PADDING,
  TRIBUNE_MARGIN,
  TRIBUNE_ROWS,
  WALL_OFFSET,
  buildTribuneBackRails,
  buildTribuneCanopyPosts,
  buildTribuneSeatPlanks,
  buildTribuneStairRails,
  buildTribuneStairStringer,
  buildTribuneStairs,
  buildTribuneTreeExclusionZone,
  canopyCenterY,
  canopyUndersideY,
  rowTopY,
  tribuneOuterEndSign,
  tribuneRowCenterX,
} from './tribune-layout';
export type {
  TTribuneCanopyPost,
  TTribuneRailPart,
  TTribuneSeatPlank,
  TTribuneStairStep,
  TTribuneStairStringer,
} from './tribune-layout';
export { accumulateLapTravel, advanceLapProgress, getTrackProgress } from './track-progress';
export type { TTrackProgress } from './track-progress.types';
export {
  CENTERLINE_TO_RACE_YAW_OFFSET,
  isRaceLapCooldownCleared,
  yawAlongCenterline,
  yawFacingRaceDirection,
} from './race-direction';

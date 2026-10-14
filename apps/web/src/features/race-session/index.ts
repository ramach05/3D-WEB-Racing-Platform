export type { TCountdownStep, TRaceHudSnapshot, TRaceStatus } from './store.types';
export {
  beginCountdown,
  finishRace,
  finishRaceForTest,
  getRaceHudSnapshot,
  pauseRace,
  RACE_LAP_TOTAL,
  readGuestBest,
  registerCheckpoint,
  registerLapComplete,
  resetRaceSession,
  resumeRace,
  setCountdownStep,
  startRacing,
  tickRace,
  togglePause,
} from './store';
export { bindRaceInput, clearTouchAxes, getDriveInput, setTouchAxis } from './input';
export type { TDriveInput } from './input.types';
export type { TTouchAxis } from './input';
export {
  VEHICLE_MAX_SPEED,
  VEHICLE_REVERSE_MAX,
  VEHICLE_ACCEL,
  VEHICLE_BRAKE,
  VEHICLE_LATERAL_GRIP,
  VEHICLE_HIGH_SPEED_STEER,
  VEHICLE_LOW_SPEED_STEER,
  VEHICLE_STEER_YAW_RATE,
  HANDBRAKE_DECEL,
  HANDBRAKE_THROTTLE_FACTOR,
  HANDBRAKE_STEER_BOOST,
  computeSteerStrength,
  dampLateralVelocity,
  integrateDriveForward,
  integrateSteerYaw,
  GROUND_NORMAL_MIN_Y,
  SLOPE_CONTACT_NORMAL_MIN_Y,
  computeGroundFollowVy,
  computeSlopePitchFromNormal,
  resolveGroundFollowVy,
  smoothVyToward,
  smoothAngleToward,
} from './vehicle-physics';
export {
  MIN_LAP_PROGRESS,
  START_FINISH_COOLDOWN_RATIO,
  canRegisterLapCrossing,
  crossedFinishLine,
  crossedFinishPlane,
  getTrackLineLocalCoords,
  isForwardFinishCrossing,
  isInsideFinishZone,
  passedCheckpointZone,
  passedFinishLine,
  passedFinishLineForward,
} from './checkpoint-rules';
export { useRaceHud, useRaceHudSelector } from './hooks';
export { getVehiclePose, setVehiclePose, type TVehiclePose } from './vehicle-pose';

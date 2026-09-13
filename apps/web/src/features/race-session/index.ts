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
  VEHICLE_HIGH_SPEED_STEER,
  VEHICLE_LOW_SPEED_STEER,
  VEHICLE_STEER_YAW_RATE,
  computeSteerStrength,
  integrateSteerYaw,
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
export { useRaceHud } from './hooks';

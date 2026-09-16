export { ChiptuneEngine } from './engine';
export type { TRaceMusicTheme } from './engine';
export {
  consumeDriveImpact,
  consumeDriveOilSlap,
  getDriveSfxSample,
  IDLE_DRIVE_SFX_SAMPLE,
  pulseDriveImpact,
  pulseDriveOilSlap,
  resetDriveSfx,
  tickDriveSfxSample,
} from './drive-sfx-bus';
export type { TDriveSfxSample } from './drive-sfx-bus';
export {
  mapImpactFromSpeed,
  mapOilSlapFromSpeed,
  mapWallScrape,
} from './drive-sfx-map';
export { DrivingSfxEngine } from './driving-sfx-engine';
export { useRaceAudio, useRaceDrivingSfx } from './hooks';

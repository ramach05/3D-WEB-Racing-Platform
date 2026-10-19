export type TDriveSfxSample = {
  /** SFX layer is active (racing + grounded path) */
  active: boolean;
  /** Horizontal speed, m/s */
  speedMs: number;
  /** Throttle 0…1 */
  throttle: number;
  /** Brake 0…1 */
  brake: number;
  /** Handbrake 0…1 */
  handbrake: number;
  /** Tire screech / oil-skid 0…1 */
  skidIntensity: number;
  /** Oil strength 0…1 */
  oilStrength: number;
  /** Wheels on an oil puddle 0…4 */
  wheelsOnOil: number;
  /** Off-road strength 0…1 */
  offRoadStrength: number;
  /** Kerb rumble 0…1 */
  kerbRumble: number;
  /** Wall scrape 0…1 */
  wallScrape: number;
  /** Touching the asphalt */
  grounded: boolean;
};

/** Zero sample — silence */
export const IDLE_DRIVE_SFX_SAMPLE: TDriveSfxSample = {
  active: false,
  speedMs: 0,
  throttle: 0,
  brake: 0,
  handbrake: 0,
  skidIntensity: 0,
  oilStrength: 0,
  wheelsOnOil: 0,
  offRoadStrength: 0,
  kerbRumble: 0,
  wallScrape: 0,
  grounded: false,
};

let sample: TDriveSfxSample = { ...IDLE_DRIVE_SFX_SAMPLE };
let pendingImpact = 0;
let pendingOilSlap = 0;

/** Writes the per-frame snapshot for SFX (no React) */
export const tickDriveSfxSample = (next: TDriveSfxSample): void => {
  sample = next;
};

/** Current snapshot for the audio tick */
export const getDriveSfxSample = (): TDriveSfxSample => sample;

/** Queues a one-shot impact (max with an already pending one) */
export const pulseDriveImpact = (intensity: number): void => {
  const clamped = Math.min(1, Math.max(0, intensity));
  if (clamped > pendingImpact) {
    pendingImpact = clamped;
  }
};

/** Takes and zeroes the pending impact; 0 if none */
export const consumeDriveImpact = (): number => {
  const value = pendingImpact;
  pendingImpact = 0;
  return value;
};

/** One-shot slap when driving onto oil */
export const pulseDriveOilSlap = (intensity: number): void => {
  const clamped = Math.min(1, Math.max(0, intensity));
  if (clamped > pendingOilSlap) {
    pendingOilSlap = clamped;
  }
};

/** Takes the oil-slap from the queue */
export const consumeDriveOilSlap = (): number => {
  const value = pendingOilSlap;
  pendingOilSlap = 0;
  return value;
};

/** Resets the snapshot and impact queue */
export const resetDriveSfx = (): void => {
  sample = { ...IDLE_DRIVE_SFX_SAMPLE };
  pendingImpact = 0;
  pendingOilSlap = 0;
};

/** Impulse shake decay (1/s) — ~0.15s until barely noticeable */
export const CAMERA_SHAKE_DECAY = 18;

/** Position amplitude (m) at shake=1 */
export const CAMERA_SHAKE_POS_AMP = 0.22;

/** lookAt amplitude (m) at shake=1 — slightly smaller than position */
export const CAMERA_SHAKE_LOOK_AMP = 0.12;

/** Multiplier for continuous shake from oil/skid/scrape */
export const CAMERA_SHAKE_CONTINUOUS_AMP = 0.35;

let impulse = 0;

/** Sets a one-shot shake (max with an already pending one) */
export const pulseCameraShake = (intensity: number): void => {
  const clamped = Math.min(1, Math.max(0, intensity));
  if (clamped > impulse) {
    impulse = clamped;
  }
};

/** Decays the impulse and returns the total strength 0…1 (`continuous` — oil/skid/scrape already in 0…1). */
export const tickCameraShake = (dt: number, continuous = 0): number => {
  const safeDt = Math.max(0, dt);
  impulse *= Math.exp(-CAMERA_SHAKE_DECAY * safeDt);
  if (impulse < 0.001) {
    impulse = 0;
  }
  const cont = Math.min(1, Math.max(0, continuous)) * CAMERA_SHAKE_CONTINUOUS_AMP;
  return Math.min(1, impulse + cont);
};

/** Current impulse without decay (for tests) */
export const getCameraShakeImpulse = (): number => impulse;

/** Reset the impulse */
export const resetCameraShake = (): void => {
  impulse = 0;
};

/** Continuous 0…1 component from the drive-SFX sample. oil full weight, skid half, scrape 0.35. */
export const mapContinuousShake = (
  oilStrength: number,
  skidIntensity: number,
  wallScrape: number,
): number => Math.min(1, Math.max(oilStrength, skidIntensity * 0.5, wallScrape * 0.35));

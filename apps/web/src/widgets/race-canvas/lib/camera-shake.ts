/** Затухание импульсного shake (1/с) — ~0.15с до едва заметного */
export const CAMERA_SHAKE_DECAY = 18;

/** Амплитуда позиции (м) при shake=1 */
export const CAMERA_SHAKE_POS_AMP = 0.22;

/** Амплитуда lookAt (м) при shake=1 — чуть меньше позиции */
export const CAMERA_SHAKE_LOOK_AMP = 0.12;

/** Множитель непрерывного shake от oil/skid/scrape */
export const CAMERA_SHAKE_CONTINUOUS_AMP = 0.35;

let impulse = 0;

/** Ставит one-shot shake (max с уже ожидающим) */
export const pulseCameraShake = (intensity: number): void => {
  const clamped = Math.min(1, Math.max(0, intensity));
  if (clamped > impulse) {
    impulse = clamped;
  }
};

/**
 * Затухает импульс и возвращает суммарную силу 0…1
 * (`continuous` — oil/skid/scrape уже в 0…1).
 */
export const tickCameraShake = (dt: number, continuous = 0): number => {
  const safeDt = Math.max(0, dt);
  impulse *= Math.exp(-CAMERA_SHAKE_DECAY * safeDt);
  if (impulse < 0.001) {
    impulse = 0;
  }
  const cont = Math.min(1, Math.max(0, continuous)) * CAMERA_SHAKE_CONTINUOUS_AMP;
  return Math.min(1, impulse + cont);
};

/** Текущий импульс без затухания (для тестов) */
export const getCameraShakeImpulse = (): number => impulse;

/** Сброс импульса */
export const resetCameraShake = (): void => {
  impulse = 0;
};

/**
 * Непрерывная составляющая 0…1 из drive-SFX sample.
 * oil полный вес, skid половина, scrape 0.35.
 */
export const mapContinuousShake = (
  oilStrength: number,
  skidIntensity: number,
  wallScrape: number,
): number =>
  Math.min(
    1,
    Math.max(oilStrength, skidIntensity * 0.5, wallScrape * 0.35),
  );

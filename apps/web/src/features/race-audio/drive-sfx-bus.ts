export type TDriveSfxSample = {
  /** SFX-слой активен (racing + grounded path) */
  active: boolean;
  /** Горизонтальная скорость, м/с */
  speedMs: number;
  /** Газ 0…1 */
  throttle: number;
  /** Тормоз 0…1 */
  brake: number;
  /** Ручник 0…1 */
  handbrake: number;
  /** Визг шин / масло-skid 0…1 */
  skidIntensity: number;
  /** Сила масла 0…1 */
  oilStrength: number;
  /** Число колёс на луже 0…4 */
  wheelsOnOil: number;
  /** Скрежет о стену 0…1 */
  wallScrape: number;
  /** Касание асфальта */
  grounded: boolean;
};

/** Нулевой sample — тишина */
export const IDLE_DRIVE_SFX_SAMPLE: TDriveSfxSample = {
  active: false,
  speedMs: 0,
  throttle: 0,
  brake: 0,
  handbrake: 0,
  skidIntensity: 0,
  oilStrength: 0,
  wheelsOnOil: 0,
  wallScrape: 0,
  grounded: false,
};

let sample: TDriveSfxSample = { ...IDLE_DRIVE_SFX_SAMPLE };
let pendingImpact = 0;
let pendingOilSlap = 0;

/** Пишет per-frame snapshot для SFX (без React) */
export const tickDriveSfxSample = (next: TDriveSfxSample): void => {
  sample = next;
};

/** Текущий snapshot для audio tick */
export const getDriveSfxSample = (): TDriveSfxSample => sample;

/** Ставит one-shot удар (берётся max с уже ожидающим) */
export const pulseDriveImpact = (intensity: number): void => {
  const clamped = Math.min(1, Math.max(0, intensity));
  if (clamped > pendingImpact) {
    pendingImpact = clamped;
  }
};

/** Забирает и обнуляет ожидающий удар; 0 если нет */
export const consumeDriveImpact = (): number => {
  const value = pendingImpact;
  pendingImpact = 0;
  return value;
};

/** One-shot «шлёп» при въезде на масло */
export const pulseDriveOilSlap = (intensity: number): void => {
  const clamped = Math.min(1, Math.max(0, intensity));
  if (clamped > pendingOilSlap) {
    pendingOilSlap = clamped;
  }
};

/** Забирает oil-slap из очереди */
export const consumeDriveOilSlap = (): number => {
  const value = pendingOilSlap;
  pendingOilSlap = 0;
  return value;
};

/** Сброс snapshot и очереди ударов */
export const resetDriveSfx = (): void => {
  sample = { ...IDLE_DRIVE_SFX_SAMPLE };
  pendingImpact = 0;
  pendingOilSlap = 0;
};

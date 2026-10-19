/** Доля скорости, потеря которой дает scrape=1 */
export const WALL_SCRAPE_FULL_LOSS = 0.45;
/** Скорость полного ударного звука (м/с) */
export const IMPACT_FULL_MS = 18;

/** Сила скрежета о стену 0…1 по потере горизонтальной скорости */
export const mapWallScrape = (desiredHz: number, slidHz: number): number => {
  if (desiredHz < 1) {
    return 0;
  }
  const loss = Math.max(0, desiredHz - slidHz) / desiredHz;
  return Math.min(1, loss / WALL_SCRAPE_FULL_LOSS);
};

/** Интенсивность one-shot удара 0…1 от скорости */
export const mapImpactFromSpeed = (speedMs: number): number => {
  if (speedMs < 0.5) {
    return 0;
  }
  return Math.min(1, speedMs / IMPACT_FULL_MS);
};

/** Интенсивность oil-slap от скорости */
export const mapOilSlapFromSpeed = (speedMs: number): number => {
  if (speedMs < 1.5) {
    return 0;
  }
  return Math.min(1, speedMs / 16);
};

/** Сила gravel-loop 0…1 от off-road strength и скорости */
export const mapGravelFromOffroad = (offRoadStrength: number, speedMs: number): number => {
  if (offRoadStrength <= 0 || speedMs < 1) {
    return 0;
  }
  const speedNorm = Math.min(1, speedMs / 22);
  return Math.min(1, offRoadStrength * (0.35 + 0.65 * speedNorm));
};

/** Нужен ли one-shot kerb tick при данном rumble и фазе 0…1 */
export const shouldPulseKerbTick = (kerbRumble: number, phase01: number): boolean => {
  if (kerbRumble < 0.18) {
    return false;
  }
  return phase01 < 0.08 + kerbRumble * 0.12;
};

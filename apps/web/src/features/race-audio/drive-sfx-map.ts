/** Speed share whose loss yields scrape=1 */
export const WALL_SCRAPE_FULL_LOSS = 0.45;
/** Speed of full impact sound (m/s) */
export const IMPACT_FULL_MS = 18;

/** Wall scrape strength 0…1 from horizontal speed loss */
export const mapWallScrape = (desiredHz: number, slidHz: number): number => {
  if (desiredHz < 1) {
    return 0;
  }
  const loss = Math.max(0, desiredHz - slidHz) / desiredHz;
  return Math.min(1, loss / WALL_SCRAPE_FULL_LOSS);
};

/** One-shot impact intensity 0…1 from speed */
export const mapImpactFromSpeed = (speedMs: number): number => {
  if (speedMs < 0.5) {
    return 0;
  }
  return Math.min(1, speedMs / IMPACT_FULL_MS);
};

/** Oil-slap intensity from speed */
export const mapOilSlapFromSpeed = (speedMs: number): number => {
  if (speedMs < 1.5) {
    return 0;
  }
  return Math.min(1, speedMs / 16);
};

/** Gravel-loop strength 0…1 from off-road strength and speed */
export const mapGravelFromOffroad = (offRoadStrength: number, speedMs: number): number => {
  if (offRoadStrength <= 0 || speedMs < 1) {
    return 0;
  }
  const speedNorm = Math.min(1, speedMs / 22);
  return Math.min(1, offRoadStrength * (0.35 + 0.65 * speedNorm));
};

/** Whether a one-shot kerb tick is due for the given rumble and phase 0…1 */
export const shouldPulseKerbTick = (kerbRumble: number, phase01: number): boolean => {
  if (kerbRumble < 0.18) {
    return false;
  }
  return phase01 < 0.08 + kerbRumble * 0.12;
};

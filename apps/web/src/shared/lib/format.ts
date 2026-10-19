/** Formats a race time in milliseconds as mm:ss.ms */
export const formatRaceTime = (ms: number): string => {
  const safeMs = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(safeMs / 60_000);
  const seconds = Math.floor((safeMs % 60_000) / 1000);
  const hundredths = Math.floor((safeMs % 1000) / 10);
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const hs = String(hundredths).padStart(2, '0');
  return `${mm}:${ss}.${hs}`;
};

/** Formats a millisecond gap as seconds with two decimals, e.g. 2450 → "2.45s" */
export const formatGap = (ms: number): string => `${(Math.max(0, ms) / 1000).toFixed(2)}s`;

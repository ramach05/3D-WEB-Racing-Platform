/** Slight lens backlight by day at rest — polycarbonate depth, not "switched on" running lights */
export const REAR_LIGHT_EMISSIVE_IDLE = 0.28;
/** Running lights on a night track (headlightsOn) — brighter than idle */
export const REAR_LIGHT_EMISSIVE_NIGHT_IDLE = 1.6;
export const REAR_LIGHT_EMISSIVE_BRAKE = 5.5;
export const REAR_LIGHT_EMISSIVE_REVERSE = 4.5;

/** Threshold in m/s: below it — reverse light mode */
export const REVERSE_LIGHT_SPEED_THRESHOLD = -0.2;

export type TRearLightMode = 'idle' | 'brake' | 'reverse';

/** Rear light mode from the brake pedal and forward speed. Reversing — white reverse; otherwise with brake — red brakes. */
export const resolveRearLightMode = (brake: number, forwardSpeed: number): TRearLightMode => {
  if (forwardSpeed < REVERSE_LIGHT_SPEED_THRESHOLD) {
    return 'reverse';
  }
  if (brake > 0) {
    return 'brake';
  }
  return 'idle';
};

/** Target emissiveIntensity for a mode; headlightsOn — night track: running lights are brighter at idle */
export const rearLightEmissiveIntensity = (
  mode: TRearLightMode,
  brake: number,
  headlightsOn = false,
): number => {
  switch (mode) {
    case 'reverse':
      return REAR_LIGHT_EMISSIVE_REVERSE;
    case 'brake': {
      const t = Math.min(Math.max(brake, 0), 1);
      const idle = headlightsOn ? REAR_LIGHT_EMISSIVE_NIGHT_IDLE : REAR_LIGHT_EMISSIVE_IDLE;
      return idle + (REAR_LIGHT_EMISSIVE_BRAKE - idle) * t;
    }
    default:
      return headlightsOn ? REAR_LIGHT_EMISSIVE_NIGHT_IDLE : REAR_LIGHT_EMISSIVE_IDLE;
  }
};

/** Легкий подсвет линзы днем в покое — глубина поликарбоната, не «включенные» габариты */
export const REAR_LIGHT_EMISSIVE_IDLE = 0.28;
/** Габариты на ночной трассе (headlightsOn) — читаемее idle */
export const REAR_LIGHT_EMISSIVE_NIGHT_IDLE = 1.6;
export const REAR_LIGHT_EMISSIVE_BRAKE = 5.5;
export const REAR_LIGHT_EMISSIVE_REVERSE = 4.5;

/** Порог м/с: ниже — режим фонарей заднего хода */
export const REVERSE_LIGHT_SPEED_THRESHOLD = -0.2;

export type TRearLightMode = 'idle' | 'brake' | 'reverse';

/** Режим задних огней по педали тормоза и продольной скорости. При движении назад — белый reverse; иначе при brake — красные стопы. */
export const resolveRearLightMode = (brake: number, forwardSpeed: number): TRearLightMode => {
  if (forwardSpeed < REVERSE_LIGHT_SPEED_THRESHOLD) {
    return 'reverse';
  }
  if (brake > 0) {
    return 'brake';
  }
  return 'idle';
};

/** Целевая emissiveIntensity для режима; headlightsOn — ночная трасса: габариты ярче в idle */
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

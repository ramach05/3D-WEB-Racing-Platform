/** Emissive задних огней в покое / при торможении / при заднем ходе */
export const REAR_LIGHT_EMISSIVE_IDLE = 0.4;
export const REAR_LIGHT_EMISSIVE_BRAKE = 5.5;
export const REAR_LIGHT_EMISSIVE_REVERSE = 4.5;

/** Порог м/с: ниже — режим фонарей заднего хода */
export const REVERSE_LIGHT_SPEED_THRESHOLD = -0.2;

export type TRearLightMode = 'idle' | 'brake' | 'reverse';

/**
 * Режим задних огней по педали тормоза и продольной скорости.
 * При движении назад — белый reverse; иначе при brake — красные стопы.
 */
export const resolveRearLightMode = (brake: number, forwardSpeed: number): TRearLightMode => {
  if (forwardSpeed < REVERSE_LIGHT_SPEED_THRESHOLD) {
    return 'reverse';
  }
  if (brake > 0) {
    return 'brake';
  }
  return 'idle';
};

/** Целевая emissiveIntensity для режима */
export const rearLightEmissiveIntensity = (mode: TRearLightMode, brake: number): number => {
  switch (mode) {
    case 'reverse':
      return REAR_LIGHT_EMISSIVE_REVERSE;
    case 'brake': {
      const t = Math.min(Math.max(brake, 0), 1);
      return REAR_LIGHT_EMISSIVE_IDLE + (REAR_LIGHT_EMISSIVE_BRAKE - REAR_LIGHT_EMISSIVE_IDLE) * t;
    }
    default:
      return REAR_LIGHT_EMISSIVE_IDLE;
  }
};

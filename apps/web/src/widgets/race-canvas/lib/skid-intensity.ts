/** Ниже этой продольной скорости (м/с) следов от торможения нет */
export const SKID_SPEED_MIN = 12;

/** При этой скорости (м/с) база brake-intensity ≈ 1 до учёта lateral */
export const SKID_SPEED_FULL = 28;

/**
 * До этой скорости (м/с) launch-wheelspin на полной тяге максимален.
 * Дальше след ослабевает — шины «цепляются».
 */
export const LAUNCH_SPEED_PEAK = 2.5;

/** Выше этой скорости (м/с) следов от разгона уже нет (~50 км/ч) */
export const LAUNCH_SPEED_END = 14;

/** Ниже этой скорости следов от ручника почти нет (если нет сильного lateral) */
export const HANDBRAKE_SKID_SPEED_MIN = 7;

/** При этой скорости база handbrake-intensity ≈ 1 до учёта lateral */
export const HANDBRAKE_SKID_SPEED_FULL = 24;

/** |lateral| (м/с), при котором боковой бонус максимален */
export const SKID_LATERAL_FULL = 8;

/** Доля бонуса от бокового скольжения к intensity (тормоз / launch) */
export const SKID_LATERAL_WEIGHT = 0.25;

/** Сильный вклад бокового срыва в дрифт-следы ручника */
export const HANDBRAKE_SKID_LATERAL_WEIGHT = 0.55;

/** Множитель intensity при ручник + газ (locked rear + drive) */
export const HANDBRAKE_THROTTLE_SKID_BOOST = 1.15;

/** Порог intensity для дыма от шин */
export const SKID_SMOKE_THRESHOLD = 0.65;

export type TSkidWheels = 'all' | 'rear';

export type TSkidIntensityInput = {
  /** Тормоз 0|1 */
  brake: number;
  /** Газ 0|1 */
  throttle: number;
  /** Ручник 0|1 */
  handbrake: number;
  /** Продольная скорость вдоль носа (м/с) */
  forwardSpeed: number;
  /** Боковая скорость (м/с) */
  lateral: number;
  /** Есть контакт колёс с землёй */
  grounded: boolean;
};

export type TSkidIntensityResult = {
  /** 0…1 — сила следа */
  intensity: number;
  /** Нужен короткий дымок */
  smoking: boolean;
  /**
   * Какие колёса оставляют след:
   * блокировка при торможении — все 4; wheelspin / дрифт — задняя ось (RWD).
   */
  wheels: TSkidWheels;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** Линейный remap value из [a,b] в [0,1] с clamp */
const remap01 = (value: number, a: number, b: number): number => {
  if (b <= a) {
    return value >= b ? 1 : 0;
  }
  return clamp01((value - a) / (b - a));
};

/** Смешивает продольный фактор с боковым срывом */
const blendWithLateral = (
  driveFactor: number,
  lateral: number,
  lateralWeight: number,
): number => {
  const lateralFactor = remap01(Math.abs(lateral), 0, SKID_LATERAL_FULL);
  return driveFactor * (1 - lateralWeight) + lateralFactor * lateralWeight;
};

/**
 * Эвристика следов для arcade-физики:
 * - резкий тормоз на скорости → блокировка, все колёса;
 * - ручник / дрифт → срыв задней оси;
 * - резкий разгон с места / малой скорости → wheelspin задней оси.
 */
export const computeSkidIntensity = (input: TSkidIntensityInput): TSkidIntensityResult => {
  if (!input.grounded) {
    return { intensity: 0, smoking: false, wheels: 'all' };
  }

  const speed = Math.abs(input.forwardSpeed);
  const lateral = input.lateral;

  // Торможение важнее: при brake+throttle это скорее emergency stop / не burnout-стенд.
  if (input.brake > 0) {
    if (speed < SKID_SPEED_MIN) {
      return { intensity: 0, smoking: false, wheels: 'all' };
    }
    const speedFactor = remap01(speed, SKID_SPEED_MIN, SKID_SPEED_FULL);
    const intensity = clamp01(
      input.brake * blendWithLateral(speedFactor, lateral, SKID_LATERAL_WEIGHT),
    );
    return {
      intensity,
      smoking: intensity > SKID_SMOKE_THRESHOLD,
      wheels: 'all',
    };
  }

  if (input.handbrake > 0) {
    const speedFactor = remap01(speed, HANDBRAKE_SKID_SPEED_MIN, HANDBRAKE_SKID_SPEED_FULL);
    let intensity = blendWithLateral(speedFactor, lateral, HANDBRAKE_SKID_LATERAL_WEIGHT);
    if (input.throttle > 0) {
      intensity *= HANDBRAKE_THROTTLE_SKID_BOOST;
    }
    intensity = clamp01(intensity);
    if (intensity <= 0) {
      return { intensity: 0, smoking: false, wheels: 'rear' };
    }
    return {
      intensity,
      smoking: intensity > SKID_SMOKE_THRESHOLD,
      wheels: 'rear',
    };
  }

  if (input.throttle > 0 && speed < LAUNCH_SPEED_END) {
    // Полный срыв у старта, затем спад по мере набора скорости (как в жизни).
    const launchEnvelope =
      speed <= LAUNCH_SPEED_PEAK ? 1 : 1 - remap01(speed, LAUNCH_SPEED_PEAK, LAUNCH_SPEED_END);
    const intensity = clamp01(
      input.throttle * blendWithLateral(launchEnvelope, lateral, SKID_LATERAL_WEIGHT),
    );
    return {
      intensity,
      smoking: intensity > SKID_SMOKE_THRESHOLD,
      wheels: 'rear',
    };
  }

  return { intensity: 0, smoking: false, wheels: 'all' };
};

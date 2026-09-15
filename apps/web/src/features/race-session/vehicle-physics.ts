export const VEHICLE_MAX_SPEED = 30;
export const VEHICLE_REVERSE_MAX = 10;
export const VEHICLE_ACCEL = 48;
export const VEHICLE_BRAKE = 72;
export const VEHICLE_LATERAL_GRIP = 11;
/** Пик силы руля после разгона; ниже — слабее, чтобы не крутиться на месте */
export const VEHICLE_LOW_SPEED_STEER = 0.58;
export const VEHICLE_HIGH_SPEED_STEER = 0.42;
/**
 * До этой скорости (м/с) сила руля растёт с нуля.
 * Выше прежнего 1.4 — на ползучей скорости yaw не разворачивает машину на месте.
 */
export const VEHICLE_STEER_ENGAGE_SPEED = 5;

/**
 * Целевая угловая скорость (рад/с) при полной силе руля (strength=1).
 * Ближе к arcade-базе (~4.32), всё ещё чуть спокойнее.
 */
export const VEHICLE_STEER_YAW_RATE = 3.6;

/**
 * Скорость сходимости yaw к цели (1/с).
 * Ближе к arcade (0.75) отклику на кадре 1/60.
 */
export const VEHICLE_YAW_FOLLOW = -Math.log(0.78) * 60;

/**
 * Затухание yaw на месте (1/с).
 * Согласовано с прежним `angvel * 0.12` на кадре 1/60: -ln(0.12)*60.
 */
export const VEHICLE_YAW_STOP = -Math.log(0.12) * 60;

/** Замедление ручника (м/с²) — заметно слабее ножного тормоза */
export const HANDBRAKE_DECEL = 22;

/**
 * Доля газа при зажатом ручнике.
 * 0.35 * ACCEL − HANDBRAKE_DECEL ≈ −5.2 м/с² — медленное падение скорости в дрифте.
 */
export const HANDBRAKE_THROTTLE_FACTOR = 0.35;

/** Боковой grip при ручнике без газа */
export const HANDBRAKE_LATERAL_GRIP = 2;

/** Боковой grip при ручнике + газе (сильнее срыв задней оси) */
export const HANDBRAKE_THROTTLE_LATERAL_GRIP = 1.2;

/** Множитель силы руля при ручнике (initiation handbrake turn) */
export const HANDBRAKE_STEER_BOOST = 1.45;

export type TDriveLongitudinalInput = {
  throttle: number;
  brake: number;
  handbrake: number;
  dt: number;
};

/**
 * Интегрирует продольную скорость: ручник приоритетнее ножного тормоза
 * и гасит скорость к нулю с обеих сторон; без ручника — тормоз/реверс как раньше.
 */
export const integrateDriveForward = (
  forwardSpeed: number,
  input: TDriveLongitudinalInput,
): number => {
  let target = forwardSpeed;
  const { throttle, brake, handbrake, dt } = input;

  if (handbrake > 0) {
    if (throttle > 0) {
      target += throttle * VEHICLE_ACCEL * HANDBRAKE_THROTTLE_FACTOR * dt;
    }
    if (target > 0) {
      target = Math.max(0, target - handbrake * HANDBRAKE_DECEL * dt);
    } else if (target < 0) {
      target = Math.min(0, target + handbrake * HANDBRAKE_DECEL * dt);
    }
    return target;
  }

  if (brake > 0) {
    if (throttle > 0) {
      target += throttle * VEHICLE_ACCEL * dt;
    }
    target -= brake * VEHICLE_BRAKE * dt;
    return target;
  }

  if (throttle > 0) {
    target += throttle * VEHICLE_ACCEL * dt;
  }
  return target;
};

/** Экспоненциальное гашение боковой скорости; ручник сильно снижает grip */
export const dampLateralVelocity = (
  lateral: number,
  handbrake: number,
  throttle: number,
  dt: number,
): number => {
  let grip = VEHICLE_LATERAL_GRIP;
  if (handbrake > 0) {
    grip = throttle > 0 ? HANDBRAKE_THROTTLE_LATERAL_GRIP : HANDBRAKE_LATERAL_GRIP;
  }
  return lateral * Math.exp(-grip * dt);
};

/** Сила руля: 0 на месте, плавный набор до engage, слабее к максимуму; ручник усиливает */
export const computeSteerStrength = (forwardSpeed: number, handbrake = 0): number => {
  const absSpeed = Math.abs(forwardSpeed);
  if (absSpeed < 0.12) {
    return 0;
  }
  const engage = Math.min(1, absSpeed / VEHICLE_STEER_ENGAGE_SPEED);
  const speedRatio = Math.min(1, absSpeed / VEHICLE_MAX_SPEED);
  const curve =
    VEHICLE_LOW_SPEED_STEER + (VEHICLE_HIGH_SPEED_STEER - VEHICLE_LOW_SPEED_STEER) * speedRatio;
  const base = curve * engage;
  return handbrake > 0 ? base * HANDBRAKE_STEER_BOOST : base;
};

/**
 * Новый yaw (рад/с), независимый от FPS.
 * Раньше `* 0.75` за кадр на тяжёлых сценах (Night City) давал почти вдвое больший отклик.
 */
export const integrateSteerYaw = (
  currentYaw: number,
  steerInput: number,
  steerStrength: number,
  steerSign: number,
  dt: number,
): number => {
  if (steerStrength <= 0) {
    return currentYaw * Math.exp(-VEHICLE_YAW_STOP * dt);
  }
  const targetYaw = steerInput * VEHICLE_STEER_YAW_RATE * steerStrength * steerSign;
  const follow = 1 - Math.exp(-VEHICLE_YAW_FOLLOW * dt);
  return currentYaw + (targetYaw - currentYaw) * follow;
};

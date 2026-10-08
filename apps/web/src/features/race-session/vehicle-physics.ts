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

/** Замедление ручника (м/с²) — слабее ножного тормоза, но без долгого выбега */
export const HANDBRAKE_DECEL = 40;

/**
 * Доля газа при зажатом ручнике.
 * 0.35 * ACCEL − HANDBRAKE_DECEL ≈ −23 м/с² — дрифт с заметным падением скорости.
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
  surfaceGrip?: number,
): number => {
  let grip = VEHICLE_LATERAL_GRIP;
  if (handbrake > 0) {
    grip = throttle > 0 ? HANDBRAKE_THROTTLE_LATERAL_GRIP : HANDBRAKE_LATERAL_GRIP;
  }
  if (surfaceGrip !== undefined) {
    grip = Math.min(grip, surfaceGrip);
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

/** Контакт с поверхностью учитывается как «дорога», только если нормаль почти вертикальна (стены — нет) */
export const GROUND_NORMAL_MIN_Y = 0.5;

/** Максимальный уклон (град), который считаем проезжей поверхностью: круче — стена/бордюр/откос */
export const SLOPE_MAX_GRADE_DEG = 20;
export const SLOPE_MAX_GRADE = (SLOPE_MAX_GRADE_DEG * Math.PI) / 180;
/** Порог нормали для «годной» земли, пригодной для подъема и визуального наклона */
export const SLOPE_CONTACT_NORMAL_MIN_Y = Math.cos(SLOPE_MAX_GRADE);

/** Потолок вертикальной составляющей подъема по склону (м/с): защита от подброса на наклонной нормали */
export const MAX_CLIMB_VY = 8;

/**
 * Вертикальная скорость (м/с), нужная чтобы скользить вдоль плоскости с нормалью
 * (nx, ny, nz) при горизонтальной скорости (vx, vz). На равнине дает 0, на подъеме —
 * ровно ту, что нужна чтобы кузов не вдавливало в полотно. Зажата по величине, чтобы
 * крутая нормаль (съезд/откос/бордюр) на высокой скорости не выстрелила машину вверх.
 */
export const computeGroundFollowVy = (
  nx: number,
  ny: number,
  nz: number,
  vx: number,
  vz: number,
): number => {
  if (ny < SLOPE_CONTACT_NORMAL_MIN_Y) {
    return 0;
  }
  const vy = -(nx * vx + nz * vz) / ny;
  const clamped = Math.max(-MAX_CLIMB_VY, Math.min(MAX_CLIMB_VY, vy));
  return clamped === 0 ? 0 : clamped;
};

/**
 * Целевой наклон кузова (рад, вокруг локальной X) по нормали склона, спроецированной
 * на направление курса (fwdX, fwdZ). КЛЮЧЕВОЕ: зависит только от геометрии нормали,
 * а не от скорости/курса — поэтому наклон не «выстреливает» на входе в поворот.
 * Подъем вперед дает отрицательный угол (нос вверх). Зажат по максимальному уклону.
 */
export const computeSlopePitchFromNormal = (
  nx: number,
  ny: number,
  nz: number,
  fwdX: number,
  fwdZ: number,
): number => {
  if (ny < SLOPE_CONTACT_NORMAL_MIN_Y) {
    return 0;
  }
  const climb = -(nx * fwdX + nz * fwdZ) / ny;
  const pitch = -Math.atan(climb);
  return Math.max(-SLOPE_MAX_GRADE, Math.min(SLOPE_MAX_GRADE, pitch));
};

/** Постоянная времени сглаживания визуального угла (с) */
export const ANGLE_SMOOTH_TAU = 0.12;
/** Потолок скорости доворота визуального угла (рад/с) */
export const ANGLE_SMOOTH_MAX_RATE = 3;

/**
 * Новое значение визуального угла (рад) при сходимости к target за dt: экспоненциально
 * (FPS-независимо) с потолком шага — без перерегулирования при резкой смене цели
 * (гребень эстакады, съезд на бордюр).
 */
export const smoothAngleToward = (current: number, target: number, dt: number): number => {
  const follow = 1 - Math.exp(-dt / ANGLE_SMOOTH_TAU);
  const step = (target - current) * follow;
  const maxStep = ANGLE_SMOOTH_MAX_RATE * dt;
  return current + Math.max(-maxStep, Math.min(maxStep, step));
};

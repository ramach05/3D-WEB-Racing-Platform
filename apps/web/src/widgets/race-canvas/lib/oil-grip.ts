import { VEHICLE_LATERAL_GRIP } from '@/features/race-session';

/** Боковой grip на полном масле (все 4 колеса) — мягче ручника */
export const OIL_LATERAL_GRIP = 2.2;

/** Доля прироста продольной скорости от газа на масле */
export const OIL_THROTTLE_FACTOR = 0.9;

/** Время затухания residual после выезда с лужи (с) */
export const OIL_RESIDUAL_SEC = 0.8;

/** Добавка yaw (рад/с) при полном руле на масле при ~top speed. Заметный рыск, без мгновенного разворота. */
export const OIL_STEER_YAW_KICK = 0.55;

/** Добавка yaw от уже имеющегося бокового сноса (на |lateral|=8) */
export const OIL_LATERAL_YAW_KICK = 0.28;

/** Ниже этой |скорости| (м/с) масляные следы не рисуем */
export const OIL_SKID_SPEED_MIN = 8;

/** При этой |скорости| (м/с) oil-skid intensity ≈ пик */
export const OIL_SKID_SPEED_FULL = 24;

/** Пик intensity следа от масла (слабее торможения) */
export const OIL_SKID_INTENSITY_PEAK = 0.55;

/** Сила масляного покрытия шин 0…1 (доля колес на масле / residual) */
let oilStrength = 0;

/** Обновить силу масла. `contactFraction` — доля колес на луже (0…1); 0 = выехали, residual гаснет. */
export const tickOilGrip = (contactFraction: number, dt: number): number => {
  const clamped = Math.max(0, Math.min(1, contactFraction));
  if (clamped > 0) {
    oilStrength = clamped;
  } else if (oilStrength > 0) {
    oilStrength = Math.max(0, oilStrength - dt / OIL_RESIDUAL_SEC);
  }
  return oilStrength;
};

/** Сбрасывает масляный residual (рестарт гонки) */
export const resetOilGrip = () => {
  oilStrength = 0;
};

/**
 * Эффективный surfaceGrip для dampLateralVelocity, или undefined если масла нет.
 * При strength=1 → OIL_LATERAL_GRIP; при затухании квадратично возвращается к асфальту.
 */
export const resolveOilSurfaceGrip = (strength: number): number | undefined => {
  if (strength <= 0) {
    return undefined;
  }
  const t = (1 - strength) * (1 - strength);
  return OIL_LATERAL_GRIP + (VEHICLE_LATERAL_GRIP - OIL_LATERAL_GRIP) * t;
};

/** Смягчает прирост продольной скорости от газа на масле (инерция вперед сохраняется). */
export const applyOilThrottleFactor = (
  forwardSpeed: number,
  targetForward: number,
  throttle: number,
  strength: number,
): number => {
  if (strength <= 0 || throttle <= 0) {
    return targetForward;
  }
  const delta = targetForward - forwardSpeed;
  if (delta <= 0) {
    return targetForward;
  }
  const factor = 1 - (1 - OIL_THROTTLE_FACTOR) * strength;
  return forwardSpeed + delta * factor;
};

/** Дополнительный рыск на масле: от руля и от уже имеющегося lateral. */
export const computeOilYawKick = (
  strength: number,
  steer: number,
  forwardSpeed: number,
  lateral: number,
): number => {
  if (strength <= 0) {
    return 0;
  }
  const speedNorm = Math.min(1, Math.abs(forwardSpeed) / 30);
  const steerKick = steer * speedNorm * OIL_STEER_YAW_KICK;
  const lateralNorm = Math.min(1, Math.abs(lateral) / 8);
  const lateralKick = Math.sign(lateral || steer) * lateralNorm * OIL_LATERAL_YAW_KICK;
  return strength * (steerKick + lateralKick);
};

/** Intensity следа от масла 0…1 при данной скорости и strength */
export const computeOilSkidIntensity = (strength: number, forwardSpeed: number): number => {
  if (strength <= 0) {
    return 0;
  }
  const speed = Math.abs(forwardSpeed);
  if (speed < OIL_SKID_SPEED_MIN) {
    return 0;
  }
  const speedFactor = Math.min(
    1,
    (speed - OIL_SKID_SPEED_MIN) / (OIL_SKID_SPEED_FULL - OIL_SKID_SPEED_MIN),
  );
  return Math.min(1, strength * OIL_SKID_INTENSITY_PEAK * (0.55 + 0.45 * speedFactor));
};

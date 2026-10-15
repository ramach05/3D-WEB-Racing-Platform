/**
 * Anti-stuck watchdog: машина аркадная и каждый кадр получает целевую скорость через
 * setLinvel, но решатель гасит forward-составляющую о препятствие. Импульс шинам дается
 * только при onCollisionEnter (и однажды), поэтому шина, зажатая машиной у стены/других
 * шин, останавливает машину намертво. Watchdog детектирует «педаль в пол, а скорости нет»
 * и непрерывно выталкивает препятствия из-под бампера, пока машина не поедет.
 */

/** Газ ниже которого залипание не считается */
export const STUCK_THROTTLE_MIN = 0.5;
/** Целевая скорость ниже которой машина и так почти стоит */
export const STUCK_TARGET_MIN_SPEED = 2;
/** Разрыв цели и фактической forward-скорости, м/с, ниже — не залипание */
export const STUCK_SPEED_GAP = 2;
/**
 * Непрерывное залипание до начала выталкивания, с. Порог заметно ниже «полного
 * стопора»: выталкивание стартует на микростолле, пока контакт не дал видимую
 * тряску и замирание (решатель держит машину в контактных колебаниях дольше 0.4 с).
 */
export const STUCK_AFTER_SECONDS = 0.15;

/** Радиус сферы выталкивания перед носом машины, м */
export const RESCUE_RADIUS = 2.5;
/** Смещение центра сферы от центра машины по курсу, м */
export const RESCUE_NOSE_OFFSET = 1.0;
/** Минимальное расстояние «машина -> препятствие», м: ближе — направление вырождено */
export const RESCUE_MIN_DIST = 0.05;
/** Ускорение выталкивания, м/с^2: заведомо выше трения шины об асфальт (~8) */
export const RESCUE_BASE_ACCEL = 14;
/** Добавка ускорения за скорость машины, м/с^2 на м/с */
export const RESCUE_CAR_ACCEL_SCALE = 2;
/** Боковая доля выталкивания: уводит препятствие из-под бампера, а не катит впереди */
export const RESCUE_SIDE_SHARE = 0.8;
/** Вертикальная доля выталкивания: препятствие перекатывается, а не скребет юзом */
export const RESCUE_UP_SHARE = 0.25;
/** Допуск бокового смещения, м: меньше — сторона выталкивания берется правая по курсу */
export const RESCUE_SIDE_DEGENERATE_EPS = 0.05;

/** Вектор в плоскости дороги */
export type TAntiStuckVec2 = { x: number; z: number };

/** Сигналы для детекта залипания */
export type TStuckProbe = {
  /** Газ 0..1 */
  throttle: number;
  /** Ручник 0..1 */
  handbrake: number;
  /** Целевая forward-скорость, м/с */
  targetForward: number;
  /** Фактическая forward-скорость, м/с */
  forwardSpeed: number;
  /** Есть ли опора под колесами */
  grounded: boolean;
};

/** Залипание: жмем газ по курсу, есть опора, а разгон не набирается */
export const isStuckAgainstObstacle = ({
  throttle,
  handbrake,
  targetForward,
  forwardSpeed,
  grounded,
}: TStuckProbe): boolean =>
  grounded &&
  handbrake <= 0 &&
  throttle > STUCK_THROTTLE_MIN &&
  targetForward > STUCK_TARGET_MIN_SPEED &&
  targetForward - forwardSpeed > STUCK_SPEED_GAP;

/** Копит таймер залипания; при восстановлении обнуляется */
export const updateStuckTimer = (stuck: boolean, dt: number, timer: number): number =>
  stuck ? timer + dt : 0;

/** Активно время дольше STUCK_AFTER_SECONDS — пора выталкивать */
export const isRescueActive = (timer: number): boolean => timer >= STUCK_AFTER_SECONDS;

/** Параметры выталкивания одного препятствия */
export type TRescueStrike = {
  /** Центр машины в плоскости дороги */
  carPosition: TAntiStuckVec2;
  /** Единичный вектор курса машины */
  carForward: TAntiStuckVec2;
  /** Центр препятствия в плоскости дороги */
  obstaclePosition: TAntiStuckVec2;
  /** Масса препятствия, кг */
  obstacleMass: number;
  /** Скорость машины (или целевая), м/с */
  carSpeed: number;
  /** Шаг симуляции, с */
  dt: number;
};

/** Импульс выталкивания, н·с */
export type TRescueImpulse = { x: number; y: number; z: number };

/**
 * Импульс выталкивания за кадр: сила (масса × ускорение), умноженная на dt, поэтому
 * непрерывное удержание гасится только контактами и трением препятствия. Направление —
 * «от машины к препятствию» с боковым уходом из-под бампера. Позади машины препятствие
 * причиной залипания быть не может -> null.
 */
export const computeRescueImpulse = ({
  carPosition,
  carForward,
  obstaclePosition,
  obstacleMass,
  carSpeed,
  dt,
}: TRescueStrike): TRescueImpulse | null => {
  let dx = obstaclePosition.x - carPosition.x;
  let dz = obstaclePosition.z - carPosition.z;
  const dist = Math.hypot(dx, dz);
  if (dist < RESCUE_MIN_DIST || dt <= 0) {
    return null;
  }
  dx /= dist;
  dz /= dist;

  const fLen = Math.hypot(carForward.x, carForward.z) || 1;
  const fx = carForward.x / fLen;
  const fz = carForward.z / fLen;
  if (dx * fx + dz * fz <= 0) {
    return null;
  }

  // боковое отклонение препятствия от оси курса — в ту же сторону и уводим
  const rightX = fz;
  const rightZ = -fx;
  const lateral = dx * rightX + dz * rightZ;
  const sideSign = Math.abs(lateral) < RESCUE_SIDE_DEGENERATE_EPS ? 1 : Math.sign(lateral);

  const accel = RESCUE_BASE_ACCEL + RESCUE_CAR_ACCEL_SCALE * Math.max(0, carSpeed);
  const escapeX = dx + rightX * sideSign * RESCUE_SIDE_SHARE;
  const escapeZ = dz + rightZ * sideSign * RESCUE_SIDE_SHARE;
  const escape = Math.hypot(escapeX, escapeZ) || 1;
  const magnitude = obstacleMass * accel * dt;

  return {
    x: (magnitude * escapeX) / escape,
    y: magnitude * RESCUE_UP_SHARE,
    z: (magnitude * escapeZ) / escape,
  };
};

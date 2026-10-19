/**
 * Тюнинг отскока топливных бочек при ударе машиной.
 *
 * Машина каждый кадр получает целевую скорость через setLinvel, поэтому в решателе
 * она работает как стена с бесконечной массой. Сама решатель может только разогнать
 * бочку до скорости машины и вести ее перед собой: без направленного отскока бочка
 * «прилипает» к бамперу и не отлетает. Поэтому удар считается явно: бочке сообщается
 * боковая скорость от оси машины плюс небольшая продольная и вертикальная, а кувырок
 * дает плечо точки приложения импульса.
 *
 * Приращения задаются в м/с, а не в н·с: масса сокращается, поэтому значения означают
 * «какую скорость получает бочка» и не зависят от массы.
 *
 * Настройки подобраны так, чтобы отскок бочки был сопоставим с разлетом шин и чуть
 * слабее его: пик скорости бочки ~1.7-1.8 скорости машины против ~1.9-2.0 у верхнего яруса
 * стопки шин (замерено headless-симуляцией на тех же параметрах решателя).
 */

/** Масса пустой стальной евробочки ⌀0.6 × 0.9 м, кг */
export const BARREL_MASS = 25;

/** Продольная доля скорости машины, передаваемая бочке (ведет ее по курсу) */
export const BARREL_FORWARD_SCALE = 0.24;

/** Боковая доля скорости машины — основной вклад в отскок */
export const BARREL_SIDE_SCALE = 1.0;

/** Боковая прибавка к отскоку на малых скоростях, м/с */
export const BARREL_SIDE_BASE_SPEED = 2.6;

/** Вертикальная доля скорости машины (подброс) */
export const BARREL_POP_SCALE = 0.1;

/** Вертикальная прибавка на малых скоростях, м/с */
export const BARREL_POP_BASE_SPEED = 0.8;

/** Плечо точки приложения импульса от центра бочки, м: выше центра — кувырок */
export const BARREL_HIT_LEVER = 0.1;

/** Эквивалентное плечо подкрутки, м: задает бочке начальное качение вдоль отскока, дальше кувырок развивает трение о землю и бампер */
export const BARREL_ROLL_ARM = 0.005;

/** Страховочный потолок: доля скорости машины */
export const BARREL_SPEED_HEADROOM = 1.75;

/** Страховочный потолок: прибавка, м/с */
export const BARREL_SPEED_BASE = 2.5;

/** Потолок скорости бочки вверх, м/с; падающую бочку не ограничиваем */
export const BARREL_MAX_UP_SPEED = 6;

/** Потолок угловой скорости бочки, рад/с */
export const BARREL_MAX_SPIN = 20;

/** Минимальное смещение бочки от оси машины, м: меньше — боковое направление вырождается (удар «в лоб» в центр бампера), сторона берется из sideBias */
export const BARREL_SIDE_DEGENERATE_EPS = 0.05;

/** Точка или вектор в плоскости XZ либо в пространстве */
export type TBarrelVec3 = { x: number; y: number; z: number };

/** Вектор в плоскости дороги */
export type TBarrelVec2 = { x: number; z: number };

/** Параметры удара машины о бочку */
export type TBarrelStrike = {
  /** Центр машины */
  carPosition: TBarrelVec3;
  /** Скорость машины в плоскости дороги */
  carVelocity: TBarrelVec2;
  /** Скорость машины по модулю, м/с (>= HIT_MIN_SPEED) */
  carSpeed: number;
  /** Центр бочки */
  barrelPosition: TBarrelVec3;
  /** Сторона отскока при вырожденном смещении: 1 вправо по курсу, -1 влево */
  sideBias: 1 | -1;
};

/** Результат удара: что приложить к телу бочки и каким потолком ограничить */
export type TBarrelBounce = {
  /** Импульс, н·с */
  impulse: TBarrelVec3;
  /** Точка приложения импульса в мире */
  point: TBarrelVec3;
  /** Импульс момента для начального качения, н·м·с */
  torqueImpulse: TBarrelVec3;
  /** Страховочный потолок горизонтальной скорости после удара, м/с */
  speedCap: number;
};

/** Направление отскока: перпендикуляр к курсу машины, направленный от ее оси к бочке. Прицентральном ударе смещение вырождается — тогда сторона из sideBias. */
export const computeBarrelSideDirection = (
  carVelocity: TBarrelVec2,
  carSpeed: number,
  carPosition: TBarrelVec3,
  barrelPosition: TBarrelVec3,
  sideBias: 1 | -1,
): TBarrelVec2 => {
  if (carSpeed <= 0) {
    return { x: sideBias, z: 0 };
  }
  // перпендикуляр к курсу в плоскости дороги
  let sideX = carVelocity.z / carSpeed;
  let sideZ = -carVelocity.x / carSpeed;
  const offset =
    (barrelPosition.x - carPosition.x) * sideX + (barrelPosition.z - carPosition.z) * sideZ;
  if (Math.abs(offset) < BARREL_SIDE_DEGENERATE_EPS) {
    return { x: sideX * sideBias, z: sideZ * sideBias };
  }
  if (offset < 0) {
    sideX = -sideX;
    sideZ = -sideZ;
  }
  return { x: sideX, z: sideZ };
};

/** Приращения скорости бочки при ударе: продольное, боковое и вертикальное, м/с */
export const computeBarrelDeltaV = (
  carSpeed: number,
): { forward: number; side: number; up: number } => {
  const speed = Math.max(0, carSpeed);
  return {
    forward: BARREL_FORWARD_SCALE * speed,
    side: BARREL_SIDE_SCALE * speed + BARREL_SIDE_BASE_SPEED,
    up: BARREL_POP_SCALE * speed + BARREL_POP_BASE_SPEED,
  };
};

/** Страховочный потолок горизонтальной скорости бочки, м/с. Заведомо выше скорости машины: потолок ниже скорости машины снова «приклеил» бы бочку к бамперу. */
export const computeBarrelSpeedCap = (carSpeed: number): number =>
  BARREL_SPEED_HEADROOM * Math.max(0, carSpeed) + BARREL_SPEED_BASE;

/**
 * Потолок скорости бочки после удара: горизонталь — потолком с сохранением
 * направления, вертикаль — только вверх (падающая бочка подчиняется гравитации),
 * угловая скорость — потолком с сохранением оси вращения.
 */
export const clampBarrelVelocity = (
  linvel: TBarrelVec3,
  angvel: TBarrelVec3,
  speedCap: number,
): { linvel: TBarrelVec3; angvel: TBarrelVec3 } => {
  const horizontal = Math.hypot(linvel.x, linvel.z);
  const scale = horizontal > speedCap && horizontal > 0 ? speedCap / horizontal : 1;
  const spin = Math.hypot(angvel.x, angvel.y, angvel.z);
  const spinScale = spin > BARREL_MAX_SPIN && spin > 0 ? BARREL_MAX_SPIN / spin : 1;
  return {
    linvel: {
      x: linvel.x * scale,
      y: Math.min(linvel.y, BARREL_MAX_UP_SPEED),
      z: linvel.z * scale,
    },
    angvel: {
      x: angvel.x * spinScale,
      y: angvel.y * spinScale,
      z: angvel.z * spinScale,
    },
  };
};

/** Отскок бочки от машины: импульс в корпус чуть выше центра (кувырок), боковая составляющая уводит бочку из-под бампера, подкрутка задает начальное качение. */
export const computeBarrelBounce = ({
  carPosition,
  carVelocity,
  carSpeed,
  barrelPosition,
  sideBias,
}: TBarrelStrike): TBarrelBounce => {
  const side = computeBarrelSideDirection(
    carVelocity,
    carSpeed,
    carPosition,
    barrelPosition,
    sideBias,
  );
  const forwardX = carSpeed > 0 ? carVelocity.x / carSpeed : 0;
  const forwardZ = carSpeed > 0 ? carVelocity.z / carSpeed : 1;
  const { forward, side: sideSpeed, up } = computeBarrelDeltaV(carSpeed);

  // направление фактического вылета — вдоль него бочка начинает катиться
  const escapeX = forwardX * forward + side.x * sideSpeed;
  const escapeZ = forwardZ * forward + side.z * sideSpeed;
  const escape = Math.hypot(escapeX, escapeZ) || 1;

  const impulseX = BARREL_MASS * escapeX;
  const impulseZ = BARREL_MASS * escapeZ;
  // ось качения горизонтальна и перпендикулярна вылету: знак дает качение, а не юл
  const rollX = (escapeZ / escape) * BARREL_MASS * BARREL_ROLL_ARM * Math.max(0, carSpeed);
  const rollZ = (-escapeX / escape) * BARREL_MASS * BARREL_ROLL_ARM * Math.max(0, carSpeed);

  return {
    impulse: { x: impulseX, y: BARREL_MASS * up, z: impulseZ },
    point: {
      x: barrelPosition.x,
      y: barrelPosition.y + BARREL_HIT_LEVER,
      z: barrelPosition.z,
    },
    torqueImpulse: { x: rollX, y: 0, z: rollZ },
    speedCap: computeBarrelSpeedCap(carSpeed),
  };
};

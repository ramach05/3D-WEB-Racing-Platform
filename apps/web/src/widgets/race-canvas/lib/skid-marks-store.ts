/** Емкость кольцевого буфера следов (4 колеса × длинный заезд) */
export const SKID_MARK_CAPACITY = 2000;

/** Минимальный шаг (м) между точками одного колеса */
export const SKID_MIN_STEP = 0.1;

/** Ширина следа ≈ пятно контакта шины (м) */
export const SKID_MARK_WIDTH = 0.18;

/** Емкость пула дыма (billboard-плоскости дешевле сфер) */
export const SKID_SMOKE_CAPACITY = 96;

/** Базовое время жизни дымовой частицы (с) */
export const SKID_SMOKE_LIFE = 1.35;

/** Доля скорости кузова, которую наследует дым */
const SMOKE_WAKE_FACTOR = 0.45;

/** Горизонтальное затухание скорости дыма (1/с) */
const SMOKE_DRAG = 1.8;

/** Подъемная сила дыма (м/с²) */
const SMOKE_BUOYANCY = 0.55;

export type TSkidMarkSegment = {
  /** Центр сегмента X */
  x: number;
  /** Центр сегмента Z */
  z: number;
  /** Yaw в плоскости XZ (рад) */
  yaw: number;
  /** Длина сегмента вдоль пути (м) */
  length: number;
  /** Ширина следа (м) */
  width: number;
  /** Начальная непрозрачность 0…1 */
  opacity: number;
  /** Возраст (с) */
  age: number;
  /** Жив ли слот */
  alive: boolean;
};

export type TSkidSmokeParticle = {
  x: number;
  y: number;
  z: number;
  /** Скорость X (м/с) */
  vx: number;
  /** Скорость Y (м/с) */
  vy: number;
  /** Скорость Z (м/с) */
  vz: number;
  /** Начальный размер */
  size: number;
  /** Легкий spin спрайта (рад) */
  spin: number;
  /** Индивидуальная жизнь (с) */
  life: number;
  /** Seed для турбулентности */
  seed: number;
  age: number;
  alive: boolean;
};

export type TSkidMarksSnapshot = {
  segments: readonly TSkidMarkSegment[];
  smoke: readonly TSkidSmokeParticle[];
};

const segments: TSkidMarkSegment[] = Array.from({ length: SKID_MARK_CAPACITY }, () => ({
  x: 0,
  z: 0,
  yaw: 0,
  length: 0,
  width: SKID_MARK_WIDTH,
  opacity: 0,
  age: 0,
  alive: false,
}));

const smoke: TSkidSmokeParticle[] = Array.from({ length: SKID_SMOKE_CAPACITY }, () => ({
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  size: 0.2,
  spin: 0,
  life: SKID_SMOKE_LIFE,
  seed: 0,
  age: 0,
  alive: false,
}));

let segmentWrite = 0;
let smokeWrite = 0;

const hashNoise = (x: number, z: number): number => {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return n - Math.floor(n);
};

/** Добавляет сегмент следа от предыдущей точки колеса к текущей. Возвращает false, если шаг слишком мал. */
export const pushSkidSample = (
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  intensity: number,
): boolean => {
  if (intensity <= 0) {
    return false;
  }

  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const length = Math.hypot(dx, dz);
  if (length < SKID_MIN_STEP) {
    return false;
  }

  const segment = segments[segmentWrite]!;
  segmentWrite = (segmentWrite + 1) % SKID_MARK_CAPACITY;

  const noise = hashNoise(toX, toZ);
  segment.x = (fromX + toX) * 0.5;
  segment.z = (fromZ + toZ) * 0.5;
  segment.yaw = Math.atan2(dx, dz);
  segment.length = length;
  segment.width = SKID_MARK_WIDTH * (0.92 + noise * 0.16);
  segment.opacity = Math.min(0.88, 0.42 + intensity * 0.46 + noise * 0.08);
  segment.age = 0;
  segment.alive = true;
  return true;
};

/** Спавнит дымок у колеса с начальной скоростью wake от кузова. vel* — мир. скорость кузова (м/с), используется как wake + jitter. */
export const pushSkidSmoke = (
  x: number,
  y: number,
  z: number,
  intensity: number,
  velX = 0,
  velY = 0,
  velZ = 0,
): void => {
  if (intensity <= 0) {
    return;
  }
  const particle = smoke[smokeWrite]!;
  smokeWrite = (smokeWrite + 1) % SKID_SMOKE_CAPACITY;
  const noise = hashNoise(x + 1.7, z - 0.3);
  const noise2 = hashNoise(z + 0.9, x - 1.1);
  const noise3 = hashNoise(x * 0.7 + 3.1, z * 1.3 - 2.4);

  particle.x = x + (noise - 0.5) * 0.14;
  particle.y = y;
  particle.z = z + (noise2 - 0.5) * 0.14;
  particle.vx = velX * SMOKE_WAKE_FACTOR + (noise - 0.5) * 0.9;
  particle.vy = 0.45 + intensity * 0.55 + noise2 * 0.35 + velY * 0.15;
  particle.vz = velZ * SMOKE_WAKE_FACTOR + (noise3 - 0.5) * 0.9;
  particle.size = 0.22 + intensity * 0.34 + noise * 0.1;
  particle.spin = (noise3 - 0.5) * Math.PI;
  particle.life = SKID_SMOKE_LIFE * (0.85 + intensity * 0.25 + noise2 * 0.2);
  particle.seed = noise * 6.283185307179586;
  particle.age = 0;
  particle.alive = true;
};

/** Старит дым; мертвые слоты помечает alive=false. Следы живут до resetSkidMarks. */
export const tickSkidMarks = (dt: number): void => {
  const clampedDt = Math.max(0, dt);
  const drag = Math.exp(-SMOKE_DRAG * clampedDt);
  for (let i = 0; i < SKID_SMOKE_CAPACITY; i += 1) {
    const particle = smoke[i]!;
    if (!particle.alive) {
      continue;
    }
    particle.age += clampedDt;
    if (particle.age >= particle.life) {
      particle.alive = false;
      continue;
    }

    const turb = Math.sin(particle.seed + particle.age * 4.2) * 0.35;
    const turbZ = Math.cos(particle.seed * 1.7 + particle.age * 3.6) * 0.35;
    particle.vx = particle.vx * drag + turb * clampedDt;
    particle.vz = particle.vz * drag + turbZ * clampedDt;
    particle.vy = particle.vy * 0.96 + SMOKE_BUOYANCY * clampedDt;
    particle.x += particle.vx * clampedDt;
    particle.y += particle.vy * clampedDt;
    particle.z += particle.vz * clampedDt;
  }
};

/** Сброс всех следов и дыма (выход из сессии / смена трека) */
export const resetSkidMarks = (): void => {
  for (let i = 0; i < SKID_MARK_CAPACITY; i += 1) {
    segments[i]!.alive = false;
    segments[i]!.age = 0;
  }
  for (let i = 0; i < SKID_SMOKE_CAPACITY; i += 1) {
    smoke[i]!.alive = false;
    smoke[i]!.age = 0;
  }
  segmentWrite = 0;
  smokeWrite = 0;
};

/** Снимок буферов для рендера (те же массивы, readonly) */
export const getSkidMarksSnapshot = (): TSkidMarksSnapshot => ({
  segments,
  smoke,
});

/** Непрозрачность сегмента (без затухания по времени в рамках гонки) */
export const skidSegmentOpacity = (segment: TSkidMarkSegment): number => {
  if (!segment.alive) {
    return 0;
  }
  return segment.opacity;
};

/** Прогресс жизни дыма 0…1 */
export const skidSmokeProgress = (particle: TSkidSmokeParticle): number => {
  if (!particle.alive) {
    return 1;
  }
  const life = particle.life > 0 ? particle.life : SKID_SMOKE_LIFE;
  return Math.min(1, particle.age / life);
};

/** Альфа-кривая дыма: быстрый набор плотности, затем мягкий спад. Пик около 20% жизни. */
export const skidSmokeOpacity = (progress: number, intensityScale = 1): number => {
  if (progress <= 0 || progress >= 1) {
    return 0;
  }
  const peak = 0.22;
  let envelope: number;
  if (progress < peak) {
    envelope = progress / peak;
  } else {
    const t = (progress - peak) / (1 - peak);
    envelope = (1 - t) * (1 - t);
  }
  return envelope * (0.22 + intensityScale * 0.18);
};

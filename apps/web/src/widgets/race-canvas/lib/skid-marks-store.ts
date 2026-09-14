/** Ёмкость кольцевого буфера следов (4 колеса × длинный заезд) */
export const SKID_MARK_CAPACITY = 2000;

/** Минимальный шаг (м) между точками одного колеса */
export const SKID_MIN_STEP = 0.1;

/** Ширина следа ≈ пятно контакта шины (м) */
export const SKID_MARK_WIDTH = 0.18;

/** Время жизни следа до полного исчезновения (с) */
export const SKID_FADE_SECONDS = 75;

/** Ёмкость пула дыма */
export const SKID_SMOKE_CAPACITY = 48;

/** Время жизни дымовой частицы (с) */
export const SKID_SMOKE_LIFE = 0.65;

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
  /** Начальный размер */
  size: number;
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
  size: 0.2,
  age: 0,
  alive: false,
}));

let segmentWrite = 0;
let smokeWrite = 0;

const hashNoise = (x: number, z: number): number => {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return n - Math.floor(n);
};

/**
 * Добавляет сегмент следа от предыдущей точки колеса к текущей.
 * Возвращает false, если шаг слишком мал.
 */
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

/** Спавнит короткий дымок у колеса */
export const pushSkidSmoke = (x: number, y: number, z: number, intensity: number): void => {
  if (intensity <= 0) {
    return;
  }
  const particle = smoke[smokeWrite]!;
  smokeWrite = (smokeWrite + 1) % SKID_SMOKE_CAPACITY;
  const noise = hashNoise(x + 1.7, z - 0.3);
  particle.x = x + (noise - 0.5) * 0.12;
  particle.y = y;
  particle.z = z + (hashNoise(z, x) - 0.5) * 0.12;
  particle.size = 0.18 + intensity * 0.28 + noise * 0.08;
  particle.age = 0;
  particle.alive = true;
};

/** Старит следы и дым; мёртвые слоты помечает alive=false */
export const tickSkidMarks = (dt: number): void => {
  const clampedDt = Math.max(0, dt);
  for (let i = 0; i < SKID_MARK_CAPACITY; i += 1) {
    const segment = segments[i]!;
    if (!segment.alive) {
      continue;
    }
    segment.age += clampedDt;
    if (segment.age >= SKID_FADE_SECONDS) {
      segment.alive = false;
    }
  }
  for (let i = 0; i < SKID_SMOKE_CAPACITY; i += 1) {
    const particle = smoke[i]!;
    if (!particle.alive) {
      continue;
    }
    particle.age += clampedDt;
    if (particle.age >= SKID_SMOKE_LIFE) {
      particle.alive = false;
    }
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

/** Текущая непрозрачность сегмента с учётом возраста */
export const skidSegmentOpacity = (segment: TSkidMarkSegment): number => {
  if (!segment.alive) {
    return 0;
  }
  const life = 1 - segment.age / SKID_FADE_SECONDS;
  return segment.opacity * Math.max(0, life);
};

/** Прогресс жизни дыма 0…1 */
export const skidSmokeProgress = (particle: TSkidSmokeParticle): number => {
  if (!particle.alive) {
    return 1;
  }
  return Math.min(1, particle.age / SKID_SMOKE_LIFE);
};

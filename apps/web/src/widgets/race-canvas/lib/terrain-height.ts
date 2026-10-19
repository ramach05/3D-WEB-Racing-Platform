import { TRACK_SLUG_COASTAL_OVAL, TRACK_SLUG_NIGHT_CITY } from '@racing/shared';
import type { TLoopPoint } from '@/entities/track';

/** Толщина стены — совпадает с place-trees / buildLoopTrack */
const WALL_THICKNESS = 0.5;
/** Runoff за стеной, где рельеф еще плоский */
const RUNOFF_CLEARANCE = 6;
/** Ширина плавного подъема от чаши к холмам (м) */
const BASIN_BLEND_WIDTH = 16;
/** Базовая амплитуда крупных холмов (м) */
const HILL_AMPLITUDE = 9;
/** Добавка мелкой детализации (м) */
const DETAIL_AMPLITUDE = 2.2;
/** Минимальная высота холма снаружи чаши при ненулевом шуме */
const MIN_OUTER_LIFT = 1.4;

/** Общие параметры рельефа вокруг трасс */
export const TRACK_TERRAIN = {
  worldSize: 480,
  segments: 128,
  basinBlendWidth: BASIN_BLEND_WIDTH,
  hillAmplitude: HILL_AMPLITUDE,
  /** Смещение mesh/коллайдера по Y — как у плоского пола */
  yOffset: -0.04,
  seeds: {
    [TRACK_SLUG_NIGHT_CITY]: 0x4e1c17e5,
    [TRACK_SLUG_COASTAL_OVAL]: 0xc0a57ea1,
  },
} as const;

/** Детерминированный seed рельефа по slug трассы */
export const terrainSeedForSlug = (slug: string): number => {
  if (slug === TRACK_SLUG_NIGHT_CITY || slug === TRACK_SLUG_COASTAL_OVAL) {
    return TRACK_TERRAIN.seeds[slug];
  }
  let hash = 2166136261;
  for (let i = 0; i < slug.length; i += 1) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/** Квадрат расстояния до ближайшей точки на полилинии centerline */
export const distanceToCenterlineSq = (x: number, z: number, centerline: TLoopPoint[]): number => {
  if (centerline.length === 0) {
    return Infinity;
  }
  let best = Infinity;
  for (let i = 0; i < centerline.length; i += 1) {
    const a = centerline[i];
    const b = centerline[(i + 1) % centerline.length];
    if (!a || !b) {
      continue;
    }
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lenSq = dx * dx + dz * dz;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lenSq));
    const px = a.x + dx * t;
    const pz = a.z + dz * t;
    const distSq = (x - px) ** 2 + (z - pz) ** 2;
    if (distSq < best) {
      best = distSq;
    }
  }
  return best;
};

/** Радиус плоской чаши вокруг трассы */
export const basinFlatRadius = (roadWidth: number): number =>
  roadWidth / 2 + WALL_THICKNESS + RUNOFF_CLEARANCE;

/** Smoothstep 0..1 */
const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** Детерминированный хэш 2D → 0..1 */
const hash2 = (x: number, y: number, seed: number): number => {
  let n = (x * 374761393 + y * 668265263 + seed) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff;
};

/** Value-noise 0..1 с билинейной интерполяцией */
const valueNoise = (x: number, y: number, seed: number): number => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
};

/** Fractional Brownian motion, результат ~0..1 */
const fbm = (x: number, y: number, seed: number, octaves: number): number => {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise(x * freq, y * freq, seed + i * 1013) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
};

export type TSampleTerrainHeightOptions = {
  /** Точки центральной линии трассы */
  centerline: TLoopPoint[];
  /** Ширина дороги */
  roadWidth: number;
  /** Seed шума */
  seed?: number;
};

/** Высота визуального рельефа в точке (x,z). Внутри дорожного коридора ≈ 0; снаружи — мягкие холмы 2–12 м. */
export const sampleTerrainHeight = (
  x: number,
  z: number,
  {
    centerline,
    roadWidth,
    seed = TRACK_TERRAIN.seeds[TRACK_SLUG_NIGHT_CITY],
  }: TSampleTerrainHeightOptions,
): number => {
  const flatRadius = basinFlatRadius(roadWidth);
  const dist = Math.sqrt(distanceToCenterlineSq(x, z, centerline));
  const mask = smoothstep(flatRadius, flatRadius + BASIN_BLEND_WIDTH, dist);
  if (mask <= 0) {
    return 0;
  }

  // Крупные волны ~50–80 м + средняя деталь + легкая рябь
  const macro = fbm(x / 72, z / 72, seed, 4);
  const mid = fbm(x / 28, z / 28, seed + 47, 3);
  const detail = fbm(x / 11, z / 11, seed + 91, 2);

  // Смещаем шум к положительным холмам с вариацией высоты
  const rolling = (macro * 0.62 + mid * 0.28 + detail * 0.1 - 0.18) * HILL_AMPLITUDE;
  const detailLift = (detail - 0.45) * DETAIL_AMPLITUDE;
  const raw = Math.max(MIN_OUTER_LIFT * macro, rolling + detailLift);

  return raw * mask;
};

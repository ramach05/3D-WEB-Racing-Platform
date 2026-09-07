import type { TLoopPoint, TOrientedBox } from './config.types';
import { isInsideCheckpoint } from './oriented-box';
import type { TPlaceTrackTreesOptions, TPlacedTree, TTreeKind } from './place-trees.types';

const WALL_THICKNESS = 0.5;
const RUNOFF_CLEARANCE = 6;
const MIN_WALL_OFFSET = 8;
const MAX_WALL_OFFSET = 40;
const MIN_TREE_SPACING = 5.5;
const MAX_TREES_COASTAL = 120;
const MAX_TREES_NIGHT = 100;
const BANDS = [10, 18, 28, 36] as const;

/** Детерминированный PRNG (mulberry32) */
const createRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Хэш slug трассы → seed для RNG */
const hashSlug = (slug: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < slug.length; i += 1) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/** Квадрат расстояния до ближайшей точки centerline */
const distanceToCenterlineSq = (x: number, z: number, centerline: TLoopPoint[]): number => {
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

/** Точка внутри любой из exclusion-зон */
const isInsideAnyZone = (x: number, z: number, zones: TOrientedBox[]): boolean => {
  for (const zone of zones) {
    if (isInsideCheckpoint(x, z, zone)) {
      return true;
    }
  }
  return false;
};

/** Достаточно ли далеко от уже поставленных деревьев */
const isFarEnough = (x: number, z: number, placed: TPlacedTree[], minDist: number): boolean => {
  const minSq = minDist * minDist;
  for (const tree of placed) {
    const dx = tree.x - x;
    const dz = tree.z - z;
    if (dx * dx + dz * dz < minSq) {
      return false;
    }
  }
  return true;
};

/** Внешняя нормаль (от центра овала/стадиона) в точке centerline. */
const outwardNormalAt = (
  points: TLoopPoint[],
  index: number,
): { nx: number; nz: number; px: number; pz: number } => {
  const pointCount = points.length;
  const current = points[index];
  const next = points[(index + 1) % pointCount];
  if (!current || !next) {
    return { nx: 1, nz: 0, px: 0, pz: 0 };
  }
  const dx = next.x - current.x;
  const dz = next.z - current.z;
  const len = Math.hypot(dx, dz) || 1;
  let nx = -dz / len;
  let nz = dx / len;
  // Внешняя сторона: нормаль, направленная от (0,0)
  const midX = (current.x + next.x) / 2;
  const midZ = (current.z + next.z) / 2;
  if (nx * midX + nz * midZ < 0) {
    nx = -nx;
    nz = -nz;
  }
  return { nx, nz, px: midX, pz: midZ };
};

/**
 * Расставляет деревья снаружи трассы: отсев по коридору, зоне трибун и минимальному шагу.
 */
export const placeTrackTrees = ({
  config,
  maxTrees,
}: TPlaceTrackTreesOptions): TPlacedTree[] => {
  const budget =
    maxTrees ?? (config.timeOfDay === 'night' ? MAX_TREES_NIGHT : MAX_TREES_COASTAL);
  const corridorRadius = config.roadWidth / 2 + WALL_THICKNESS + RUNOFF_CLEARANCE;
  const corridorRadiusSq = corridorRadius * corridorRadius;
  const rng = createRng(hashSlug(config.slug) ^ 0x7e3a91c5);
  const placed: TPlacedTree[] = [];
  const points = config.centerline;
  if (points.length === 0) {
    return placed;
  }

  const candidates: { x: number; z: number; kind: TTreeKind; scale: number; rotationY: number }[] =
    [];

  for (let i = 0; i < points.length; i += 1) {
    const { nx, nz, px, pz } = outwardNormalAt(points, i);
    for (const band of BANDS) {
      const jitterR = (rng() - 0.5) * 4.5;
      const jitterAlong = (rng() - 0.5) * 3.2;
      const tx = -nz;
      const tz = nx;
      const offset = band + jitterR;
      if (offset < MIN_WALL_OFFSET || offset > MAX_WALL_OFFSET) {
        continue;
      }
      const wallOffset = config.roadWidth / 2 + WALL_THICKNESS;
      const x = px + nx * (wallOffset + offset) + tx * jitterAlong;
      const z = pz + nz * (wallOffset + offset) + tz * jitterAlong;
      candidates.push({
        x,
        z,
        kind: rng() < 0.55 ? 'pine' : 'broadleaf',
        scale: 0.75 + rng() * 0.55,
        rotationY: rng() * Math.PI * 2,
      });

      // Иногда кучка из 2–3 деревьев рядом
      if (rng() < 0.28) {
        const clusterCount = 1 + Math.floor(rng() * 2);
        for (let c = 0; c < clusterCount; c += 1) {
          const angle = rng() * Math.PI * 2;
          const dist = 3.5 + rng() * 3;
          candidates.push({
            x: x + Math.cos(angle) * dist,
            z: z + Math.sin(angle) * dist,
            kind: rng() < 0.5 ? 'pine' : 'broadleaf',
            scale: 0.7 + rng() * 0.5,
            rotationY: rng() * Math.PI * 2,
          });
        }
      }
    }
  }

  // Перемешиваем кандидатов детерминированно
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = candidates[i]!;
    candidates[i] = candidates[j]!;
    candidates[j] = tmp;
  }

  for (const candidate of candidates) {
    if (placed.length >= budget) {
      break;
    }
    const { x, z } = candidate;
    if (distanceToCenterlineSq(x, z, points) < corridorRadiusSq) {
      continue;
    }
    if (isInsideAnyZone(x, z, config.treeExclusionZones)) {
      continue;
    }
    if (!isFarEnough(x, z, placed, MIN_TREE_SPACING)) {
      continue;
    }
    placed.push({
      x,
      z,
      scale: candidate.scale,
      rotationY: candidate.rotationY,
      kind: candidate.kind,
    });
  }

  return placed;
};

/** Экспорт констант для тестов */
export const TREE_PLACEMENT_LIMITS = {
  coastalMax: MAX_TREES_COASTAL,
  nightMax: MAX_TREES_NIGHT,
  corridorRunoff: RUNOFF_CLEARANCE,
  minSpacing: MIN_TREE_SPACING,
} as const;

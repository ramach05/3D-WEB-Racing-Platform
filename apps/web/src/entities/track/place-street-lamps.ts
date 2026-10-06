import { isInsideCheckpoint } from './oriented-box';
import type { TLoopPoint, TOrientedBox, TTrackConfig } from './config.types';
import type { TPlacedStreetLamp, TPlaceStreetLampsOptions } from './place-street-lamps.types';

const WALL_THICKNESS = 0.25;
/** Отступ столба за внешней гранью стены */
const WALL_OUTSET = 1.2;
/**
 * Шаг станций вдоль периметра (по одной лампе, стороны чередуются).
 * Реже столбы — меньше Spot-кандидатов и draw calls на Night City.
 */
const DEFAULT_SPACING = 28;
/** Не ставить фонари слишком близко к гантри / старту */
const START_FINISH_CLEARANCE = 14;
/** Минимальный зазор между столбами (после фильтра зон) */
const MIN_LAMP_SPACING = 42;

/** Точка внутри любой из exclusion-зон */
const isInsideAnyZone = (x: number, z: number, zones: TOrientedBox[]): boolean => {
  for (const zone of zones) {
    if (isInsideCheckpoint(x, z, zone)) {
      return true;
    }
  }
  return false;
};

/** Квадрат расстояния до центра линии старт/финиш */
const distanceToStartFinishSq = (x: number, z: number, line: TOrientedBox): number => {
  const dx = x - line.position[0];
  const dz = z - line.position[2];
  return dx * dx + dz * dz;
};

/**
 * Касательная и внешняя нормаль в точке на ребре centerline.
 * `t` — доля отрезка [index → index+1].
 */
const frameAtEdge = (
  points: TLoopPoint[],
  index: number,
  t: number,
): { px: number; pz: number; nx: number; nz: number } | null => {
  const pointCount = points.length;
  const current = points[index];
  const next = points[(index + 1) % pointCount];
  if (!current || !next) {
    return null;
  }
  const dx = next.x - current.x;
  const dz = next.z - current.z;
  const len = Math.hypot(dx, dz) || 1;
  const px = current.x + dx * t;
  const pz = current.z + dz * t;
  let nx = -dz / len;
  let nz = dx / len;
  if (nx * px + nz * pz < 0) {
    nx = -nx;
    nz = -nz;
  }
  return { px, pz, nx, nz };
};

/** Достаточно ли далеко от уже поставленных фонарей */
const isFarEnough = (
  x: number,
  z: number,
  placed: TPlacedStreetLamp[],
  minDist: number,
): boolean => {
  const minSq = minDist * minDist;
  for (const lamp of placed) {
    const dx = lamp.x - x;
    const dz = lamp.z - z;
    if (dx * dx + dz * dz < minSq) {
      return false;
    }
  }
  return true;
};

/**
 * yaw так, чтобы локальная +X смотрела в (towardX, towardZ) на плоскости XZ.
 * Three.js: (1,0,0) → (cos θ, 0, −sin θ).
 */
const yawToward = (towardX: number, towardZ: number): number => Math.atan2(-towardZ, towardX);

/** Можно ли поставить столб в (x, z) */
const canPlaceAt = (
  x: number,
  z: number,
  config: TTrackConfig,
  placed: TPlacedStreetLamp[],
  startFinishClearanceSq: number,
): boolean => {
  if (isInsideAnyZone(x, z, config.treeExclusionZones)) {
    return false;
  }
  if (distanceToStartFinishSq(x, z, config.startFinishLine) < startFinishClearanceSq) {
    return false;
  }
  if (!isFarEnough(x, z, placed, MIN_LAMP_SPACING)) {
    return false;
  }
  return true;
};

/**
 * Расставляет уличные фонари вдоль трассы: по одному на станцию, стороны чередуются.
 * Свет включается отдельно при рендере (`timeOfDay === 'night'`).
 */
export const placeStreetLamps = ({
  config,
  spacing = DEFAULT_SPACING,
}: TPlaceStreetLampsOptions): TPlacedStreetLamp[] => {
  const points = config.centerline;
  if (points.length < 2) {
    return [];
  }

  const wallOffset = config.roadWidth / 2 + WALL_THICKNESS + WALL_OUTSET;
  const startFinishClearanceSq = START_FINISH_CLEARANCE * START_FINISH_CLEARANCE;
  const placed: TPlacedStreetLamp[] = [];

  let nextDist = spacing * 0.5;
  let traveled = 0;
  /** Чётные станции — внешняя сторона, нечётные — внутренняя */
  let stationIndex = 0;

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    if (!current || !next) {
      continue;
    }
    const edgeLen = Math.hypot(next.x - current.x, next.z - current.z);
    if (edgeLen < 1e-6) {
      continue;
    }

    while (nextDist <= traveled + edgeLen) {
      const t = (nextDist - traveled) / edgeLen;
      const frame = frameAtEdge(points, i, t);
      if (frame) {
        const { px, pz, nx, nz } = frame;
        const preferOuter = stationIndex % 2 === 0;
        const sideOrder: readonly { sx: number; sz: number; sideSign: 1 | -1 }[] = preferOuter
          ? [
              { sx: nx, sz: nz, sideSign: 1 },
              { sx: -nx, sz: -nz, sideSign: -1 },
            ]
          : [
              { sx: -nx, sz: -nz, sideSign: -1 },
              { sx: nx, sz: nz, sideSign: 1 },
            ];

        for (const { sx, sz, sideSign } of sideOrder) {
          const x = px + sx * wallOffset;
          const z = pz + sz * wallOffset;
          if (!canPlaceAt(x, z, config, placed, startFinishClearanceSq)) {
            continue;
          }
          placed.push({
            x,
            z,
            rotationY: yawToward(-sx, -sz),
            sideSign,
          });
          break;
        }
      }
      stationIndex += 1;
      nextDist += spacing;
    }

    traveled += edgeLen;
  }

  return placed;
};

/** Экспорт констант для тестов */
export const STREET_LAMP_PLACEMENT = {
  defaultSpacing: DEFAULT_SPACING,
  wallOutset: WALL_OUTSET,
  wallThickness: WALL_THICKNESS,
  startFinishClearance: START_FINISH_CLEARANCE,
  minLampSpacing: MIN_LAMP_SPACING,
} as const;

/** Для тестов: ожидаемый диапазон числа фонарей на Night City (чередование сторон) */
export const expectedNightCityLampCount = (config: TTrackConfig): { min: number; max: number } => {
  let perimeter = 0;
  const points = config.centerline;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (!a || !b) {
      continue;
    }
    perimeter += Math.hypot(b.x - a.x, b.z - a.z);
  }
  const stations = Math.max(1, Math.floor(perimeter / DEFAULT_SPACING));
  // После отсева у трибун / старта ещё MIN_LAMP_SPACING режет близкие столбы на длинных петлях
  const spacingCap = Math.max(3, Math.floor(perimeter / MIN_LAMP_SPACING) + 2);
  return {
    min: Math.max(3, Math.min(stations - 8, spacingCap - 6)),
    max: Math.min(stations + 2, spacingCap + 2),
  };
};

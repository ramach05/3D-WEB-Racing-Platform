import type { TTrackSlug } from '@racing/shared';
import { TRACK_SLUG_COASTAL_OVAL, TRACK_SLUG_NIGHT_CITY } from '@racing/shared';
import { carSkins, trackPalettes } from '@/shared/config';
import type {
  TBuildLoopOptions,
  TLoopPoint,
  TObstacleKind,
  TOrientedBox,
  TTrackConfig,
  TTrackObstacle,
  TVec3,
} from './config.types';
import { buildTribuneTreeExclusionZone } from './tribune-layout';
import { yawFacingRaceDirection } from './race-direction';

/** Точка на полилинии на заданном расстоянии от начала (рост индекса). */
const placeAlongPolyline = (
  points: TLoopPoint[],
  distanceMeters: number,
): { x: number; z: number; dx: number; dz: number } => {
  const pointCount = points.length;
  const first = points[0];
  const second = points[1] ?? first;
  if (!first || !second || pointCount < 2) {
    return { x: first?.x ?? 0, z: first?.z ?? 0, dx: 0, dz: 1 };
  }

  let remaining = Math.max(0, distanceMeters);
  for (let i = 0; i < pointCount; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % pointCount];
    if (!a || !b) {
      continue;
    }
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const segLen = Math.hypot(dx, dz);
    if (segLen < 1e-6) {
      continue;
    }
    if (remaining <= segLen) {
      const t = remaining / segLen;
      return { x: a.x + dx * t, z: a.z + dz * t, dx, dz };
    }
    remaining -= segLen;
  }

  const dx = second.x - first.x;
  const dz = second.z - first.z;
  return { x: first.x, z: first.z, dx, dz };
};

/** Строит замкнутую трассу по точкам центральной линии */
const buildLoopTrack = ({
  slug,
  points,
  roadWidth,
  palette,
  carSkin,
  audioTheme,
  spawnOffsetMeters,
  startTribuneSide,
}: TBuildLoopOptions): TTrackConfig => {
  const pointCount = points.length;
  const walls: TOrientedBox[] = [];
  const wallHeight = 1.35;
  const wallThickness = 0.5;

  for (let i = 0; i < pointCount; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % pointCount];
    if (!a || !b) {
      continue;
    }
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.001) {
      continue;
    }
    const rotationY = Math.atan2(dx, dz);
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const offset = roadWidth / 2 + wallThickness / 2 - 0.08;
    const segmentOverlap = len + wallThickness * 1.6;

    const nx = -dz / len;
    const nz = dx / len;
    walls.push({
      position: [mx + nx * offset, wallHeight / 2, mz + nz * offset],
      size: [wallThickness, wallHeight, segmentOverlap],
      rotationY,
    });
    walls.push({
      position: [mx - nx * offset, wallHeight / 2, mz - nz * offset],
      size: [wallThickness, wallHeight, segmentOverlap],
      rotationY,
    });
  }

  for (let i = 0; i < pointCount; i += 1) {
    const prev = points[(i - 1 + pointCount) % pointCount];
    const curr = points[i];
    const next = points[(i + 1) % pointCount];
    if (!prev || !curr || !next) {
      continue;
    }
    const t1x = curr.x - prev.x;
    const t1z = curr.z - prev.z;
    const t2x = next.x - curr.x;
    const t2z = next.z - curr.z;
    const len1 = Math.hypot(t1x, t1z) || 1;
    const len2 = Math.hypot(t2x, t2z) || 1;
    const nx1 = -t1z / len1;
    const nz1 = t1x / len1;
    const nx2 = -t2z / len2;
    const nz2 = t2x / len2;
    const bisX = nx1 + nx2;
    const bisZ = nz1 + nz2;
    const bisLen = Math.hypot(bisX, bisZ) || 1;
    const capOffset = roadWidth / 2 + wallThickness / 2 - 0.08;
    const capSize = wallThickness * 1.5;
    for (const sign of [1, -1] as const) {
      walls.push({
        position: [
          curr.x + (bisX / bisLen) * capOffset * sign,
          wallHeight / 2,
          curr.z + (bisZ / bisLen) * capOffset * sign,
        ],
        size: [capSize, wallHeight, capSize],
        rotationY: Math.atan2(bisX, bisZ),
      });
    }
  }

  /** Ширина зоны чекпоинта/финиша: запас за край дороги (кривые трассы). */
  const checkpointWidth = roadWidth + 4;

  /** Чекпоинт на доле петли centerline (0..1) */
  const buildCheckpointAtRatio = (ratio: number): TOrientedBox => {
    const index = Math.floor(ratio * pointCount) % pointCount;
    const current = points[index];
    const next = points[(index + 1) % pointCount];
    if (!current || !next) {
      return {
        position: [0, 1.4, 0] as TVec3,
        size: [checkpointWidth, 2.8, 3.2] as TVec3,
        rotationY: 0,
      };
    }
    const dx = next.x - current.x;
    const dz = next.z - current.z;
    return {
      position: [current.x, 1.4, current.z],
      size: [checkpointWidth, 2.8, 3.2],
      rotationY: Math.atan2(dx, dz),
    };
  };

  const intermediateCheckpointRatios = [0.25, 0.5, 0.75];
  const startFinishLine = buildCheckpointAtRatio(0);
  const checkpoints: TOrientedBox[] = [
    ...intermediateCheckpointRatios.map(buildCheckpointAtRatio),
    startFinishLine,
  ];

  /** Фиксированные метры от финиша — одинаково на любой плотности точек. */
  const spawnPose = placeAlongPolyline(points, spawnOffsetMeters);

  return {
    slug,
    spawnPosition: [spawnPose.x, 0.85, spawnPose.z],
    // Направление заезда ≠ рост индекса centerline — см. race-direction.ts
    spawnRotationY: yawFacingRaceDirection(spawnPose.dx, spawnPose.dz),
    startFinishLine,
    walls,
    checkpoints,
    obstacles: [],
    oilSlicks: [],
    centerline: points,
    roadWidth,
    palette,
    carSkin,
    audioTheme,
    timeOfDay: audioTheme === 'night' ? 'night' : 'day',
    startTribuneSide,
    treeExclusionZones: [
      buildTribuneTreeExclusionZone({
        startFinishLine,
        roadWidth,
        side: startTribuneSide,
      }),
    ],
  };
};

/** Размещает препятствие вдоль centerline с боковым смещением (нормаль влево). */
const placeAlongCenterline = (
  points: TLoopPoint[],
  ratio: number,
  lateral: number,
  size: TVec3,
  kind: TObstacleKind,
): TTrackObstacle => {
  const pointCount = points.length;
  const index = Math.floor(((((ratio % 1) + 1) % 1) * pointCount) % pointCount);
  const current = points[index];
  const next = points[(index + 1) % pointCount];
  if (!current || !next) {
    return {
      position: [0, size[1] / 2, 0],
      size,
      rotationY: 0,
      kind,
    };
  }
  const dx = next.x - current.x;
  const dz = next.z - current.z;
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  return {
    position: [current.x + nx * lateral, size[1] / 2, current.z + nz * lateral],
    size,
    rotationY: Math.atan2(dx, dz),
    kind,
  };
};

const TIRE_STACK_SIZE: TVec3 = [1.05, 1.2, 1.05];
const FUEL_BARREL_SIZE: TVec3 = [0.85, 1.35, 0.85];

const obstacleSizeFor = (kind: TObstacleKind): TVec3 =>
  kind === 'fuelBarrel' ? FUEL_BARREL_SIZE : TIRE_STACK_SIZE;

type TObstacleBank = {
  /** Доля петли centerline 0..1 */
  ratio: number;
  /** Сторона стенки относительно направления движения */
  side: 1 | -1;
  /** Тип препятствия на каждый ряд от бордюра */
  kinds: TObstacleKind[];
  /** Отступы от стены к центру полосы — каждый inset = отдельный ряд */
  rowInsets: readonly number[];
};

/** Собирает препятствия из банков вдоль centerline. */
const buildObstaclesFromBanks = (
  points: TLoopPoint[],
  roadWidth: number,
  banks: TObstacleBank[],
): TTrackObstacle[] => {
  const obstacles: TTrackObstacle[] = [];
  for (const bank of banks) {
    for (let i = 0; i < bank.rowInsets.length; i += 1) {
      const kind = bank.kinds[i] ?? bank.kinds[0] ?? 'tireStack';
      const inset = bank.rowInsets[i] ?? 0.7;
      const lateral = bank.side * (roadWidth / 2 - inset);
      obstacles.push(
        placeAlongCenterline(points, bank.ratio, lateral, obstacleSizeFor(kind), kind),
      );
    }
  }
  return obstacles;
};

/** Ширина × толщина × длина пятна масла (м) */
const OIL_SLICK_SIZE: TVec3 = [2.2, 0.04, 3.0];

/** Высота центра пятна над y=0 (асфальт ~0.1) */
const OIL_SLICK_CENTER_Y = 0.12;

/**
 * Размещает лужу масла вдоль centerline с боковым смещением (нормаль влево).
 * y не участвует в hit-тесте (XZ), но задаёт высоту меша.
 */
const placeOilSlickAlongCenterline = (
  points: TLoopPoint[],
  ratio: number,
  lateral: number,
  size: TVec3 = OIL_SLICK_SIZE,
): TOrientedBox => {
  const pointCount = points.length;
  const index = Math.floor(((((ratio % 1) + 1) % 1) * pointCount) % pointCount);
  const current = points[index];
  const next = points[(index + 1) % pointCount];
  if (!current || !next) {
    return {
      position: [0, OIL_SLICK_CENTER_Y, 0],
      size,
      rotationY: 0,
    };
  }
  const dx = next.x - current.x;
  const dz = next.z - current.z;
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  return {
    position: [current.x + nx * lateral, OIL_SLICK_CENTER_Y, current.z + nz * lateral],
    size,
    rotationY: Math.atan2(dx, dz),
  };
};

/**
 * Лужа за N метров до финиша по направлению заезда.
 * Заезд: сторона спавна (+lz) → через линию → конец петли (−lz).
 * Подход к финишу — вдоль роста centerline от линии (как спавн), не с конца петли.
 */
const placeOilSlickMetersBeforeFinish = (
  points: TLoopPoint[],
  metersBeforeFinish: number,
  lateral: number,
  size: TVec3 = OIL_SLICK_SIZE,
): TOrientedBox => {
  const pose = placeAlongPolyline(points, Math.max(0, metersBeforeFinish));
  const segLen = Math.hypot(pose.dx, pose.dz) || 1;
  const nx = -pose.dz / segLen;
  const nz = pose.dx / segLen;
  return {
    position: [pose.x + nx * lateral, OIL_SLICK_CENTER_Y, pose.z + nz * lateral],
    size,
    rotationY: Math.atan2(pose.dx, pose.dz),
  };
};

type TOilSlickSpot = {
  /** Доля петли centerline 0..1 */
  ratio: number;
  /** Смещение от центра полосы по нормали (м) */
  lateral: number;
};

/** Собирает лужи масла из точек вдоль centerline. */
const buildOilSlicks = (points: TLoopPoint[], spots: TOilSlickSpot[]): TOrientedBox[] =>
  spots.map((spot) => placeOilSlickAlongCenterline(points, spot.ratio, spot.lateral));

/**
 * Coastal Oval: свободные участки между банками препятствий.
 * 0.12 — после старта до первого банка (0.27); 0.54 — между 0.485 и 0.61.
 */
const buildCoastalOvalOilSlicks = (points: TLoopPoint[]): TOrientedBox[] =>
  buildOilSlicks(points, [
    { ratio: 0.12, lateral: 0.85 },
    { ratio: 0.54, lateral: -0.95 },
  ]);

/**
 * Night City: первая — просвет между банками; вторая — 70 м до финиша по заезду.
 */
const buildNightCityOilSlicks = (points: TLoopPoint[]): TOrientedBox[] => [
  placeOilSlickAlongCenterline(points, 0.23, 1.05),
  placeOilSlickMetersBeforeFinish(points, 70, -0.75),
];

/** Стопки шин и бочки у стенок Coastal Oval: несколько рядов от бордюра. */
const buildCoastalOvalObstacles = (points: TLoopPoint[], roadWidth: number): TTrackObstacle[] => {
  const triple = [0.7, 1.85, 3.0] as const;
  const tires: TObstacleKind[] = ['tireStack', 'tireStack', 'tireStack'];
  const barrels: TObstacleKind[] = ['fuelBarrel', 'fuelBarrel', 'fuelBarrel'];

  return buildObstaclesFromBanks(points, roadWidth, [
    { ratio: 0.27, side: -1, kinds: tires, rowInsets: triple },
    { ratio: 0.315, side: -1, kinds: ['fuelBarrel', 'tireStack', 'tireStack'], rowInsets: triple },
    { ratio: 0.44, side: 1, kinds: tires, rowInsets: triple },
    { ratio: 0.485, side: 1, kinds: barrels, rowInsets: triple },
    { ratio: 0.61, side: -1, kinds: tires, rowInsets: triple },
    { ratio: 0.655, side: -1, kinds: tires, rowInsets: triple },
    { ratio: 0.78, side: 1, kinds: ['fuelBarrel', 'fuelBarrel', 'tireStack'], rowInsets: triple },
    { ratio: 0.825, side: 1, kinds: tires, rowInsets: triple },
  ]);
};

/** Препятствия Night City: 4 ряда от бордюра (дорога 10 м) — шины и бочки. */
const buildNightCityObstacles = (points: TLoopPoint[], roadWidth: number): TTrackObstacle[] => {
  /** Четвёртый inset ≈ центр полосы с зазором; шаги ~1.15 м под габарит стопки. */
  const quad = [0.7, 1.85, 3.0, 4.15] as const;
  const tires: TObstacleKind[] = ['tireStack', 'tireStack', 'tireStack', 'tireStack'];
  const barrels: TObstacleKind[] = ['fuelBarrel', 'fuelBarrel', 'fuelBarrel', 'fuelBarrel'];

  return buildObstaclesFromBanks(points, roadWidth, [
    { ratio: 0.1, side: 1, kinds: tires, rowInsets: quad },
    {
      ratio: 0.18,
      side: -1,
      kinds: ['fuelBarrel', 'tireStack', 'tireStack', 'fuelBarrel'],
      rowInsets: quad,
    },
    { ratio: 0.28, side: 1, kinds: barrels, rowInsets: quad },
    {
      ratio: 0.38,
      side: -1,
      kinds: ['tireStack', 'fuelBarrel', 'tireStack', 'tireStack'],
      rowInsets: quad,
    },
    {
      ratio: 0.48,
      side: 1,
      kinds: ['fuelBarrel', 'fuelBarrel', 'tireStack', 'fuelBarrel'],
      rowInsets: quad,
    },
    { ratio: 0.58, side: -1, kinds: tires, rowInsets: quad },
    {
      ratio: 0.68,
      side: 1,
      kinds: ['tireStack', 'tireStack', 'fuelBarrel', 'tireStack'],
      rowInsets: quad,
    },
    { ratio: 0.78, side: -1, kinds: barrels, rowInsets: quad },
    {
      ratio: 0.88,
      side: 1,
      kinds: ['fuelBarrel', 'tireStack', 'tireStack', 'tireStack'],
      rowInsets: quad,
    },
  ]);
};

/** Эллиптическая трасса */
const buildEllipsePoints = (radiusX: number, radiusZ: number, count: number): TLoopPoint[] => {
  const points: TLoopPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = (i / count) * Math.PI * 2;
    points.push({ x: Math.cos(t) * radiusX, z: Math.sin(t) * radiusZ });
  }
  return points;
};

type TPathSegment =
  | {
      kind: 'line';
      from: readonly [number, number];
      to: readonly [number, number];
      length: number;
    }
  | {
      kind: 'arc';
      center: readonly [number, number];
      radius: number;
      angleStart: number;
      angleDelta: number;
      length: number;
    };

type TDriveCommand =
  { type: 'line'; length: number } | { type: 'arc'; radius: number; delta: number };

/** Равномерная выборка по длине пути из line/arc сегментов */
const samplePathSegments = (segments: readonly TPathSegment[], count: number): TLoopPoint[] => {
  const perimeter = segments.reduce((sum, seg) => sum + seg.length, 0);
  if (perimeter < 1e-3 || count < 8) {
    return [];
  }
  const points: TLoopPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    let remaining = (i / count) * perimeter;
    let point: TLoopPoint | null = null;
    for (const seg of segments) {
      if (remaining > seg.length) {
        remaining -= seg.length;
        continue;
      }
      const t = seg.length > 0 ? remaining / seg.length : 0;
      if (seg.kind === 'line') {
        point = {
          x: seg.from[0] + (seg.to[0] - seg.from[0]) * t,
          z: seg.from[1] + (seg.to[1] - seg.from[1]) * t,
        };
      } else {
        const angle = seg.angleStart + t * seg.angleDelta;
        point = {
          x: seg.center[0] + Math.cos(angle) * seg.radius,
          z: seg.center[1] + Math.sin(angle) * seg.radius,
        };
      }
      break;
    }
    if (point) {
      points.push(point);
    }
  }
  return points;
};

/**
 * Строит замкнутую трассу из команд «прямая / дуга» (heading 0 = +X, CCW+).
 * Сумма дуг должна быть ±2π, длины прямых — подобраны под замыкание петли.
 */
const buildDrivenLoopPoints = (
  start: TLoopPoint,
  startHeading: number,
  commands: readonly TDriveCommand[],
  count: number,
): TLoopPoint[] => {
  let x = start.x;
  let z = start.z;
  let heading = startHeading;
  const segments: TPathSegment[] = [];

  for (const cmd of commands) {
    if (cmd.type === 'line') {
      const x1 = x + Math.cos(heading) * cmd.length;
      const z1 = z + Math.sin(heading) * cmd.length;
      segments.push({
        kind: 'line',
        from: [x, z],
        to: [x1, z1],
        length: cmd.length,
      });
      x = x1;
      z = z1;
      continue;
    }

    const side = Math.sign(cmd.delta) || 1;
    const cx = x - Math.sin(heading) * cmd.radius * side;
    const cz = z + Math.cos(heading) * cmd.radius * side;
    const angleStart = Math.atan2(z - cz, x - cx);
    segments.push({
      kind: 'arc',
      center: [cx, cz],
      radius: cmd.radius,
      angleStart,
      angleDelta: cmd.delta,
      length: Math.abs(cmd.delta) * cmd.radius,
    });
    heading += cmd.delta;
    x = cx + Math.cos(angleStart + cmd.delta) * cmd.radius;
    z = cz + Math.sin(angleStart + cmd.delta) * cmd.radius;
  }

  return samplePathSegments(segments, count);
};

/**
 * Night City street circuit: стартовая прямая, T1-sweeper, эски (S),
 * широкие углы. Дуги как раньше (min R=26); прямые укорочены для компактности.
 * L0+L5 — одна стартовая прямая; L5 подобран под замыкание петли.
 */
const NIGHT_CITY_DRIVE: readonly TDriveCommand[] = [
  { type: 'line', length: 52 },
  { type: 'arc', radius: 34, delta: Math.PI / 2 },
  { type: 'line', length: 14 },
  { type: 'arc', radius: 28, delta: Math.PI / 2 },
  { type: 'line', length: 6 },
  // Эски: net turn 0, извилистая связка
  { type: 'arc', radius: 26, delta: Math.PI * 0.4 },
  { type: 'arc', radius: 26, delta: -Math.PI * 0.8 },
  { type: 'arc', radius: 26, delta: Math.PI * 0.4 },
  { type: 'line', length: 6 },
  { type: 'arc', radius: 30, delta: Math.PI / 2 },
  { type: 'line', length: 14 },
  { type: 'arc', radius: 32, delta: Math.PI / 2 },
  { type: 'line', length: 50.91 },
];

const coastalOvalPoints = buildEllipsePoints(58, 36, 44);
const coastalOvalRoadWidth = 10;

export const coastalOvalTrack: TTrackConfig = {
  ...buildLoopTrack({
    slug: TRACK_SLUG_COASTAL_OVAL,
    points: coastalOvalPoints,
    roadWidth: coastalOvalRoadWidth,
    palette: trackPalettes.coastal,
    carSkin: carSkins.coastal,
    audioTheme: 'coastal',
    spawnOffsetMeters: 5,
    startTribuneSide: 'left',
  }),
  obstacles: buildCoastalOvalObstacles(coastalOvalPoints, coastalOvalRoadWidth),
  oilSlicks: buildCoastalOvalOilSlicks(coastalOvalPoints),
};

/** Street-circuit Night City: drive-команды → равномерная выборка */
const nightCityPoints = buildDrivenLoopPoints({ x: -28, z: -48 }, 0, NIGHT_CITY_DRIVE, 64);
const nightCityRoadWidth = 10;

export const nightCityTrack: TTrackConfig = {
  ...buildLoopTrack({
    slug: TRACK_SLUG_NIGHT_CITY,
    points: nightCityPoints,
    roadWidth: nightCityRoadWidth,
    palette: trackPalettes.night,
    carSkin: carSkins.night,
    audioTheme: 'night',
    spawnOffsetMeters: 5,
    startTribuneSide: 'left',
  }),
  obstacles: buildNightCityObstacles(nightCityPoints, nightCityRoadWidth),
  oilSlicks: buildNightCityOilSlicks(nightCityPoints),
};

const TRACKS_BY_SLUG: Record<TTrackSlug, TTrackConfig> = {
  [TRACK_SLUG_COASTAL_OVAL]: coastalOvalTrack,
  [TRACK_SLUG_NIGHT_CITY]: nightCityTrack,
};

/** Конфиг трассы по slug с API */
export const getTrackConfig = (slug: string): TTrackConfig | null => {
  if (slug === TRACK_SLUG_COASTAL_OVAL || slug === TRACK_SLUG_NIGHT_CITY) {
    return TRACKS_BY_SLUG[slug] ?? null;
  }
  return null;
};

/** Все локальные конфиги трасс */
export const getAllTrackConfigs = (): TTrackConfig[] => {
  return [coastalOvalTrack, nightCityTrack];
};

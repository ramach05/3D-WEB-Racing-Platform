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


/** Строит замкнутую трассу по точкам центральной линии */
const buildLoopTrack = ({
  slug,
  points,
  roadWidth,
  palette,
  carSkin,
  audioTheme,
  spawnRatio,
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

  /** Чекпоинт на доле петли centerline (0..1) */
  const buildCheckpointAtRatio = (ratio: number): TOrientedBox => {
    const index = Math.floor(ratio * pointCount) % pointCount;
    const current = points[index];
    const next = points[(index + 1) % pointCount];
    if (!current || !next) {
      return {
        position: [0, 1.4, 0] as TVec3,
        size: [roadWidth + 1.5, 2.8, 3.2] as TVec3,
        rotationY: 0,
      };
    }
    const dx = next.x - current.x;
    const dz = next.z - current.z;
    return {
      position: [current.x, 1.4, current.z],
      size: [roadWidth + 1.5, 2.8, 3.2],
      rotationY: Math.atan2(dx, dz),
    };
  };

  const intermediateCheckpointRatios = [0.25, 0.5, 0.75];
  const startFinishLine = buildCheckpointAtRatio(0);
  const checkpoints: TOrientedBox[] = [
    ...intermediateCheckpointRatios.map(buildCheckpointAtRatio),
    startFinishLine,
  ];

  const spawnIndex = Math.floor(spawnRatio * pointCount) % pointCount;
  const spawn = points[spawnIndex];
  const spawnNext = points[(spawnIndex + 1) % pointCount];
  const spawnDx = (spawnNext?.x ?? 0) - (spawn?.x ?? 0);
  const spawnDz = (spawnNext?.z ?? 0) - (spawn?.z ?? 0);
  const spawnLen = Math.hypot(spawnDx, spawnDz) || 1;
  const spawnAdvance = 5;

  return {
    slug,
    spawnPosition: [
      (spawn?.x ?? 0) + (spawnDx / spawnLen) * spawnAdvance,
      0.85,
      (spawn?.z ?? 0) + (spawnDz / spawnLen) * spawnAdvance,
    ],
    spawnRotationY: Math.atan2(spawnDx, spawnDz) + Math.PI,
    startFinishLine,
    walls,
    checkpoints,
    obstacles: [],
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

/** Стопки шин у стенок Coastal Oval: несколько рядов от бордюра. */
const buildCoastalOvalObstacles = (points: TLoopPoint[], roadWidth: number): TTrackObstacle[] => {
  const tireSize: TVec3 = [1.05, 1.2, 1.05];
  /** Отступы от стены к центру полосы — каждый inset = отдельный ряд */
  const rowInsets = [0.7, 1.85, 3.0] as const;
  const obstacles: TTrackObstacle[] = [];

  /** По 2 стопки вдоль трассы на банк (было 4) — вдвое меньше */
  const banks: { ratios: number[]; side: 1 | -1 }[] = [
    { ratios: [0.27, 0.315], side: -1 },
    { ratios: [0.44, 0.485], side: 1 },
    { ratios: [0.61, 0.655], side: -1 },
    { ratios: [0.78, 0.825], side: 1 },
  ];

  for (const bank of banks) {
    for (const ratio of bank.ratios) {
      for (const inset of rowInsets) {
        const lateral = bank.side * (roadWidth / 2 - inset);
        obstacles.push(placeAlongCenterline(points, ratio, lateral, tireSize, 'tireStack'));
      }
    }
  }

  return obstacles;
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

/** Стадион: скруглённый прямоугольник */
const buildStadiumPoints = (
  width: number,
  depth: number,
  cornerRadius: number,
  count: number,
): TLoopPoint[] => {
  const hw = width / 2 - cornerRadius;
  const hd = depth / 2 - cornerRadius;
  type TStadiumSegment = {
    /** Начало прямого участка */
    from: readonly [number, number];
    /** Конец прямого участка */
    to: readonly [number, number];
    /** Центр дуги поворота, если сегмент угловой */
    arc?: readonly [number, number];
  };
  const segments: TStadiumSegment[] = [
    { from: [-hw, -hd - cornerRadius], to: [hw, -hd - cornerRadius] },
    {
      from: [hw + cornerRadius, -hd],
      to: [hw + cornerRadius, hd],
      arc: [hw + cornerRadius, -hd],
    },
    { from: [hw, hd + cornerRadius], to: [-hw, hd + cornerRadius] },
    {
      from: [-hw - cornerRadius, hd],
      to: [-hw - cornerRadius, -hd],
      arc: [-hw - cornerRadius, hd],
    },
  ];

  const points: TLoopPoint[] = [];
  const perSegment = Math.floor(count / 4);
  for (let s = 0; s < 4; s += 1) {
    const seg = segments[s];
    if (!seg) {
      continue;
    }
    for (let i = 0; i < perSegment; i += 1) {
      const t = i / perSegment;
      if (seg.arc && (s === 1 || s === 3)) {
        const angleStart = s === 1 ? -Math.PI / 2 : Math.PI / 2;
        const angle = angleStart + t * Math.PI;
        points.push({
          x: seg.arc[0] + Math.cos(angle) * cornerRadius,
          z: seg.arc[1] + Math.sin(angle) * cornerRadius,
        });
      } else {
        points.push({
          x: seg.from[0] + (seg.to[0] - seg.from[0]) * t,
          z: seg.from[1] + (seg.to[1] - seg.from[1]) * t,
        });
      }
    }
  }
  return points;
};

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
    spawnRatio: 0.02,
    startTribuneSide: 'left',
  }),
  obstacles: buildCoastalOvalObstacles(coastalOvalPoints, coastalOvalRoadWidth),
};

export const nightCityTrack = buildLoopTrack({
  slug: TRACK_SLUG_NIGHT_CITY,
  points: buildStadiumPoints(72, 48, 14, 48),
  roadWidth: 9,
  palette: trackPalettes.night,
  carSkin: carSkins.night,
  audioTheme: 'night',
  spawnRatio: 0.04,
  startTribuneSide: 'left',
});

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

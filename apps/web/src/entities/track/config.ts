import type { TTrackSlug } from '@racing/shared';
import {
  TRACK_SLUG_COASTAL_OVAL,
  TRACK_SLUG_NIGHT_CITY,
  TRACK_SLUG_STORM_EIGHT,
} from '@racing/shared';
import { carSkins, trackPalettes } from '@/shared/config';
import type {
  TBuildLoopOptions,
  TLoopPoint,
  TObstacleKind,
  TOrientedBox,
  TTimeOfDay,
  TTrackConfig,
  TTrackObstacle,
  TVec3,
} from './config.types';
import { buildTribuneTreeExclusionZone } from './tribune-layout';
import { yawFacingRaceDirection } from './race-direction';

/** Point on the polyline at a given distance from the start (index increasing). */
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

/**
 * The overlap by which adjacent wall segments intersect at the joints so that
 * turns have no gaps. A fixed value (not tied to thickness),
 * otherwise thinning the wall would shorten short segments on dense tracks.
 */
const WALL_SEGMENT_OVERLAP = 0.8;

/** Builds a closed track from centerline points */
const buildLoopTrack = ({
  slug,
  points,
  roadWidth,
  palette,
  carSkin,
  audioTheme,
  spawnOffsetMeters,
  startTribuneSide,
  wallExclusionWindows = [],
  centerlineY,
  weather,
}: TBuildLoopOptions): TTrackConfig => {
  const pointCount = points.length;
  const walls: TOrientedBox[] = [];
  const wallHeight = 0.85;
  const wallThickness = 0.25;

  const inExclusion = (ratio: number): boolean => {
    for (const [ws, we] of wallExclusionWindows) {
      if (ratio >= ws && ratio <= we) {
        return true;
      }
    }
    return false;
  };

  // Roadway height at a point (centerline y; asphalt top = y + ROAD_TOP_Y in the road ribbon)
  const deckY = (i: number): number => points[i]?.y ?? 0;

  for (let i = 0; i < pointCount; i += 1) {
    if (inExclusion(i / pointCount)) {
      continue;
    }
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
    const segmentOverlap = len + WALL_SEGMENT_OVERLAP;
    // Wall sits on the roadway: vertical center = average segment height + half wall height
    const wallCenterY = (deckY(i) + deckY((i + 1) % pointCount)) / 2 + wallHeight / 2;

    const nx = -dz / len;
    const nz = dx / len;
    walls.push({
      position: [mx + nx * offset, wallCenterY, mz + nz * offset],
      size: [wallThickness, wallHeight, segmentOverlap],
      rotationY,
    });
    walls.push({
      position: [mx - nx * offset, wallCenterY, mz - nz * offset],
      size: [wallThickness, wallHeight, segmentOverlap],
      rotationY,
    });
  }

  for (let i = 0; i < pointCount; i += 1) {
    if (inExclusion(i / pointCount)) {
      continue;
    }
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
      const capY = deckY(i) + wallHeight / 2;
      walls.push({
        position: [
          curr.x + (bisX / bisLen) * capOffset * sign,
          capY,
          curr.z + (bisZ / bisLen) * capOffset * sign,
        ],
        size: [capSize, wallHeight, capSize],
        rotationY: Math.atan2(bisX, bisZ),
      });
    }
  }

  /** Checkpoint/finish zone width: margin beyond the road edge (curved tracks). */
  const checkpointWidth = roadWidth + 4;

  /** Checkpoint at a centerline loop ratio (0..1) */
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

  /** Fixed meters from the finish line — identical at any point density. */
  const spawnPose = placeAlongPolyline(points, spawnOffsetMeters);
  /** Spawn on the roadway: +0.85 above the nearest centerline point height */
  let spawnDeckY = 0;
  let spawnBest = Infinity;
  for (let i = 0; i < pointCount; i += 1) {
    const p = points[i];
    if (!p) {
      continue;
    }
    const d = (p.x - spawnPose.x) ** 2 + (p.z - spawnPose.z) ** 2;
    if (d < spawnBest) {
      spawnBest = d;
      spawnDeckY = p.y ?? 0;
    }
  }

  /** night only when audioTheme === 'night' */
  const derivedTimeOfDay: TTimeOfDay = audioTheme === 'night' ? 'night' : 'day';

  return {
    slug,
    spawnPosition: [spawnPose.x, spawnDeckY + 0.85, spawnPose.z],
    // Race direction ≠ centerline index growth — see race-direction.ts
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
    timeOfDay: derivedTimeOfDay,
    startTribuneSide,
    treeExclusionZones: [
      buildTribuneTreeExclusionZone({
        startFinishLine,
        roadWidth,
        side: startTribuneSide,
      }),
    ],
    centerlineY,
    wallExclusionWindows,
    weather,
  };
};

/** Places an obstacle along the centerline with a lateral offset (left normal). */
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
  // centerline y accounts for elevated decks (Storm Eight); y=0 on flat tracks
  return {
    position: [current.x + nx * lateral, (current.y ?? 0) + size[1] / 2, current.z + nz * lateral],
    size,
    rotationY: Math.atan2(dx, dz),
    kind,
  };
};

/** Stack of three truck tyres ⌀1.2 m lying flat */
const TIRE_STACK_SIZE: TVec3 = [1.2, 1.05, 1.2];
/** Standard Euro barrel ⌀0.6 × 0.9 m */
const FUEL_BARREL_SIZE: TVec3 = [0.62, 0.9, 0.62];

const obstacleSizeFor = (kind: TObstacleKind): TVec3 =>
  kind === 'fuelBarrel' ? FUEL_BARREL_SIZE : TIRE_STACK_SIZE;

type TObstacleBank = {
  /** Centerline loop ratio 0..1 */
  ratio: number;
  /** Wall side relative to the direction of travel */
  side: 1 | -1;
  /** Obstacle kind for each row from the kerb */
  kinds: TObstacleKind[];
  /** Offsets from the wall toward the lane center — each inset = a separate row */
  rowInsets: readonly number[];
};

/** Builds obstacles from banks along the centerline. */
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

/** Width × thickness × length of the oil slick (m) */
const OIL_SLICK_SIZE: TVec3 = [2.2, 0.04, 3.0];

/** Slick center height above y=0 (asphalt ~0.1) */
const OIL_SLICK_CENTER_Y = 0.12;

/** Places an oil slick along the centerline with a lateral offset (left normal). y is not used in the hit test (XZ) but sets the mesh height. */
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
 * Oil slick N meters before the finish line along the race direction.
 * Race: spawn side (+lz) → across the line → loop end (−lz).
 * The approach to the finish runs along centerline index growth from the line (like spawn), not from the loop end.
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
  /** Centerline loop ratio 0..1 */
  ratio: number;
  /** Offset from the lane center along the normal (m) */
  lateral: number;
};

/** Builds oil slicks from points along the centerline. */
const buildOilSlicks = (points: TLoopPoint[], spots: TOilSlickSpot[]): TOrientedBox[] =>
  spots.map((spot) => placeOilSlickAlongCenterline(points, spot.ratio, spot.lateral));

/**
 * Coastal Oval: open stretches between obstacle banks.
 * 0.12 — after the start before the first bank (0.27); 0.54 — between 0.485 and 0.61.
 */
const buildCoastalOvalOilSlicks = (points: TLoopPoint[]): TOrientedBox[] =>
  buildOilSlicks(points, [
    { ratio: 0.12, lateral: 0.85 },
    { ratio: 0.54, lateral: -0.95 },
  ]);

/** Night City: first — a gap between banks; second — 70 m before the finish line along the race direction. */
const buildNightCityOilSlicks = (points: TLoopPoint[]): TOrientedBox[] => [
  placeOilSlickAlongCenterline(points, 0.23, 1.05),
  placeOilSlickMetersBeforeFinish(points, 70, -0.75),
];

/** Tyre stacks and barrels along the Coastal Oval walls: several rows from the kerb. */
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

/** Night City obstacles: 4 rows from the kerb (10 m road) — tyres and barrels. */
const buildNightCityObstacles = (points: TLoopPoint[], roadWidth: number): TTrackObstacle[] => {
  // The fourth inset ≈ lane center with clearance; ~1.15 m steps sized to the stack footprint.
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

/** Elliptical track */
const buildEllipsePoints = (radiusX: number, radiusZ: number, count: number): TLoopPoint[] => {
  const points: TLoopPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = (i / count) * Math.PI * 2;
    points.push({ x: Math.cos(t) * radiusX, z: Math.sin(t) * radiusZ });
  }
  return points;
};

/** Closed polyline → uniform arc-length sampling (XZ), N points. Needed so the center step and heading kinks are even (config tests + tiling). */
const resampleClosedByArcLength = (dense: TLoopPoint[], count: number): TLoopPoint[] => {
  const n = dense.length;
  const cum: number[] = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i += 1) {
    const a = dense[i]!;
    const b = dense[(i + 1) % n]!;
    cum[i + 1] = cum[i]! + Math.hypot(b.x - a.x, b.z - a.z);
  }
  const total = cum[n]!;
  const out: TLoopPoint[] = [];
  let seg = 0;
  for (let k = 0; k < count; k += 1) {
    const target = (k / count) * total;
    while (seg < n - 1 && cum[seg + 1]! < target) {
      seg += 1;
    }
    const a = dense[seg]!;
    const b = dense[(seg + 1) % n]!;
    const segLen = cum[seg + 1]! - cum[seg]!;
    const t = segLen > 1e-6 ? (target - cum[seg]!) / segLen : 0;
    out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  }
  return out;
};

/** Gaussian over a closed index: distance in indices accounting for wraparound */
const gaussianAt = (i: number, center: number, count: number, sigmaIdx: number): number => {
  let d = Math.abs(i - center);
  d = Math.min(d, count - d);
  return Math.exp(-(d * d) / (2 * sigmaIdx * sigmaIdx));
};

/**
 * Storm Eight: a large figure eight (Gerono lemniscate) with an ELEVATED DECK at the center of
 * the crossing — the only climb on the track.
 *
 * The branches cross at 90°, the overlap window along the arc is small, so:
 *  - one visit of the node is raised by a gaussian (bridge) — the ribbons split apart in Y;
 *  - the second visit stays at the bottom (drive under the bridge).
 * Heights are in meters above the plane (asphalt top = y + ROAD_TOP_Y in the road ribbon).
 */
const buildFigureEightPoints = (count: number): TLoopPoint[] => {
  const scale = 50;
  const phase = Math.PI / 4;

  // 1) dense lemniscate sampling
  const dense: TLoopPoint[] = [];
  const denseCount = count * 12;
  for (let i = 0; i < denseCount; i += 1) {
    const shiftedT = ((i / denseCount) * Math.PI * 2 + phase) % (Math.PI * 2);
    const x = scale * Math.cos(shiftedT);
    const z = -scale * Math.sin(shiftedT) * Math.cos(shiftedT);
    dense.push({ x, z });
  }

  // 2) uniform arc-length sampling
  const pts = resampleClosedByArcLength(dense, count);

  // 3) indices of the two node visits (closest approach to (0,0))
  const prox = pts.map((p) => p.x * p.x + p.z * p.z);
  const minProx = Math.min(...prox);
  const nearNode = prox.map((v) => v < minProx * 1.25 + 0.5);
  let node1 = -1;
  let node2 = -1;
  for (let i = 0; i < count; i += 1) {
    if (!nearNode[i]) {
      continue;
    }
    if (node1 === -1) {
      node1 = i;
    } else if (i > node1 && (node2 === -1 || i > node2)) {
      node2 = i;
    }
  }
  // Fallback: if the nodes were not found — take the theoretical ratios 0.125 / 0.625
  if (node1 === -1 || node2 === -1) {
    node1 = Math.round(0.125 * count);
    node2 = Math.round(0.625 * count);
  }

  /**
   * Bridge: gentle (grade ~8–9°) so the car can climb it on its own. At a 90° crossing
   * the branches diverge ~1:1, so for 10 m wide ribbons to separate
   * a core of ±5–6 m around the node is enough; 4 m of height gives clearance for the lower pass.
   */
  const bridgeHeight = 4;
  const bridgeSigma = count * 0.05; // ~15 m along the arc: gentle climb/descent

  for (let i = 0; i < count; i += 1) {
    // The bridge raises the SECOND node visit; the first one stays at the bottom
    const bridge = gaussianAt(i, node2, count, bridgeSigma) * bridgeHeight;
    pts[i] = { x: pts[i]!.x, z: pts[i]!.z, y: bridge };
  }
  return pts;
};

/**
 * Piers under the raised roadway (elevated bridge deck). Placed only under LONG
 * climbs: short humps are earth embankments, piers under them would look
 * like a bug.
 *
 * Realistic overpass scheme: a column pair directly UNDER the slab edges +
 * a transverse cap beam abutting the deck soffit (columns hold the cap,
 * the cap holds the roadway). Columns stand under the roadway, not beside it.
 *
 * Exception — the crossing zone: the lower branch passes under the bridge there, and a
 * column would end up on someone else's road. Such stations stay without
 * piers — a clean span over the overpass (like real interchanges).
 */
const buildDeckPiers = (points: readonly TLoopPoint[], roadWidth: number): TOrientedBox[] => {
  const n = points.length;
  if (n < 4) {
    return [];
  }
  const minY = 0.9; // below this — no piers needed
  const minSpanMeters = 20; // shorter — an embankment, not a bridge
  const stepMeters = 6;
  // Columns under the slab edges: inside the walls, right under the deck
  const lateral = roadWidth / 2 - 0.9;
  const columnWidth = 0.8;
  const capHeight = 0.5; // cap beam
  const capDepth = 1.1; // along the roadway
  const baseY = -0.15; // column base sinks into the ground
  const deckSoffit = (y: number): number => y - 0.1; // deck soffit = y + ROAD_TOP_Y - ROAD_THICKNESS

  const segLen = (i: number): number => {
    const a = points[i]!;
    const b = points[(i + 1) % n]!;
    return Math.hypot(b.x - a.x, b.z - a.z);
  };
  const above = points.map((p) => (p.y ?? 0) > minY);

  const piers: TOrientedBox[] = [];
  for (let start = 0; start < n; start += 1) {
    if (!above[start] || above[(start - 1 + n) % n]) {
      continue;
    }
    let span = 0;
    let end = start;
    while (above[(end + 1) % n] && (end + 1) % n !== start) {
      span += segLen(end);
      end = (end + 1) % n;
    }
    if (span < minSpanMeters) {
      continue;
    }
    // Indices belonging to this climb together with its mouths: when checking
    // for a "foreign lower road" we ignore the climb's own points
    const own = new Set<number>();
    const mouthBuffer = 8;
    for (let k = 0; k <= end - start; k += 1) {
      own.add((start + k) % n);
    }
    for (let k = 1; k <= mouthBuffer; k += 1) {
      own.add((start - k + n) % n);
      own.add((end + k) % n);
    }
    // Low points outside the climb — that is the lower road under the bridge
    const foreign = points
      .map((p, idx) => ({ p, idx }))
      .filter(({ p, idx }) => (p.y ?? 0) < minY && !own.has(idx));

    let dist = 0;
    let nextStation = 0;
    let i = start;
    for (;;) {
      if (dist >= nextStation) {
        nextStation += stepMeters;
        const p = points[i]!;
        const prev = points[(i - 1 + n) % n]!;
        const next = points[(i + 1) % n]!;
        const dx = next.x - prev.x;
        const dz = next.z - prev.z;
        const len = Math.hypot(dx, dz) || 1;
        const nx = -dz / len;
        const nz = dx / len;
        const rotationY = Math.atan2(dx, dz);
        const soffit = deckSoffit(p.y ?? 0);
        const top = soffit + 0.15; // column overlaps into the deck soffit
        const h = Math.max(top - baseY, 0.3);
        const centerY = (top + baseY) / 2;

        const columns: Array<[number, number]> = [];
        for (const sign of [1, -1] as const) {
          const px = p.x + nx * lateral * sign;
          const pz = p.z + nz * lateral * sign;
          // A column is not allowed if it would stand on the lower road
          let blocked = false;
          for (const { p: q } of foreign) {
            if (Math.hypot(q.x - px, q.z - pz) < roadWidth / 2 + 0.5) {
              blocked = true;
              break;
            }
          }
          if (blocked) {
            continue;
          }
          columns.push([px, pz]);
          piers.push({
            position: [px, centerY, pz],
            size: [columnWidth, h, columnWidth],
            rotationY,
          });
        }
        // Keep the cap beam only where there is a pier; do not hang a pure span
        if (columns.length > 0) {
          piers.push({
            position: [p.x, soffit - capHeight / 2 + 0.08, p.z],
            size: [roadWidth + 0.6, capHeight, capDepth],
            rotationY,
          });
        }
      }
      if (i === end) {
        break;
      }
      dist += segLen(i);
      i = (i + 1) % n;
    }
  }
  return piers;
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

/** Uniform sampling along the length of a path made of line/arc segments */
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

/** Builds a closed track from "straight / arc" commands (heading 0 = +X, CCW+). The arc sum must be ±2π, straight lengths — tuned so the loop closes. */
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
 * Night City street circuit: start straight, T1 sweeper, esses (S),
 * wide corners. Arcs as before (min R=26); straights shortened for compactness.
 * L0+L5 — one start straight; L5 tuned so the loop closes.
 */
const NIGHT_CITY_DRIVE: readonly TDriveCommand[] = [
  { type: 'line', length: 52 },
  { type: 'arc', radius: 34, delta: Math.PI / 2 },
  { type: 'line', length: 14 },
  { type: 'arc', radius: 28, delta: Math.PI / 2 },
  { type: 'line', length: 6 },
  // Esses: net turn 0, winding sequence
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
    startTribuneSide: 'right',
  }),
  obstacles: buildCoastalOvalObstacles(coastalOvalPoints, coastalOvalRoadWidth),
  oilSlicks: buildCoastalOvalOilSlicks(coastalOvalPoints),
};

/** Street-circuit Night City: drive commands → uniform sampling */
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

// ---------------------------------------------------------------------------
// Storm Eight — large figure eight with an elevated deck at the crossing center, rain
// ---------------------------------------------------------------------------
const STORM_EIGHT_POINTS = buildFigureEightPoints(240);
const STORM_EIGHT_ROAD_WIDTH = 10;

const stormEightCenterlineY = STORM_EIGHT_POINTS.map((p) => p.y ?? 0);

/** Rows on flat sections + barrels on the elevated deck crest (plateau ≈0.617–0.667, y ~4 m). No obstacles under the bridge (≈0.125). */
const STORM_EIGHT_OBSTACLES = (points: TLoopPoint[], roadWidth: number): TTrackObstacle[] => {
  const triple = [0.7, 1.85, 3.0] as const;
  const tires: TObstacleKind[] = ['tireStack', 'tireStack', 'tireStack'];
  const barrels: TObstacleKind[] = ['fuelBarrel', 'fuelBarrel', 'fuelBarrel'];

  return buildObstaclesFromBanks(points, roadWidth, [
    { ratio: 0.05, side: -1, kinds: tires, rowInsets: triple },
    { ratio: 0.2, side: 1, kinds: barrels, rowInsets: triple },
    { ratio: 0.28, side: -1, kinds: ['fuelBarrel', 'tireStack', 'tireStack'], rowInsets: triple },
    { ratio: 0.52, side: -1, kinds: tires, rowInsets: triple },
    { ratio: 0.68, side: 1, kinds: barrels, rowInsets: triple },
    { ratio: 0.94, side: 1, kinds: tires, rowInsets: triple },
    // Barrels on the flat bridge crest
    { ratio: 0.625, side: 1, kinds: barrels, rowInsets: triple },
  ]);
};

const stormEightOilSlicks = (points: TLoopPoint[]): TOrientedBox[] => [
  placeOilSlickAlongCenterline(points, 0.22, 1.2),
  placeOilSlickAlongCenterline(points, 0.55, -1.0),
  placeOilSlickAlongCenterline(points, 0.72, 0.9),
];

export const stormEightTrack: TTrackConfig = {
  ...buildLoopTrack({
    slug: TRACK_SLUG_STORM_EIGHT,
    points: STORM_EIGHT_POINTS,
    roadWidth: STORM_EIGHT_ROAD_WIDTH,
    palette: trackPalettes.storm,
    carSkin: carSkins.storm,
    audioTheme: 'rock',
    spawnOffsetMeters: 5,
    startTribuneSide: 'left',
    centerlineY: stormEightCenterlineY,
    weather: 'rain',
  }),
  obstacles: STORM_EIGHT_OBSTACLES(STORM_EIGHT_POINTS, STORM_EIGHT_ROAD_WIDTH),
  oilSlicks: stormEightOilSlicks(STORM_EIGHT_POINTS),
  piers: buildDeckPiers(STORM_EIGHT_POINTS, STORM_EIGHT_ROAD_WIDTH),
};

const TRACKS_BY_SLUG: Record<TTrackSlug, TTrackConfig> = {
  [TRACK_SLUG_COASTAL_OVAL]: coastalOvalTrack,
  [TRACK_SLUG_NIGHT_CITY]: nightCityTrack,
  [TRACK_SLUG_STORM_EIGHT]: stormEightTrack,
};

/** Track config by API slug */
export const getTrackConfig = (slug: string): TTrackConfig | null => {
  if (
    slug === TRACK_SLUG_COASTAL_OVAL ||
    slug === TRACK_SLUG_NIGHT_CITY ||
    slug === TRACK_SLUG_STORM_EIGHT
  ) {
    return TRACKS_BY_SLUG[slug] ?? null;
  }
  return null;
};

/** All local track configs */
export const getAllTrackConfigs = (): TTrackConfig[] => {
  return [coastalOvalTrack, nightCityTrack, stormEightTrack];
};

/** Lighting on: at night or in stormy rain (dark overcast sky). True only for Night City and Storm Eight; Coastal (clear day) — false. */
export const isTrackLightingOn = (config: TTrackConfig): boolean =>
  config.timeOfDay === 'night' || config.weather === 'rain';

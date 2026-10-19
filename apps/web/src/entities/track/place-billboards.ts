import { TRACK_SLUG_NIGHT_CITY } from '@racing/shared';
import { isInsideCheckpoint } from './oriented-box';
import type { TLoopPoint, TOrientedBox, TTrackConfig } from './config.types';
import {
  BILLBOARD_AD_IDS,
  type TBillboardAdId,
  type TPlacedBillboard,
  type TPlaceBillboardsOptions,
} from './place-billboards.types';
import { placeStreetLamps } from './place-street-lamps';
import type { TPlacedStreetLamp } from './place-street-lamps.types';

const WALL_THICKNESS = 0.25;
/** Frame outset beyond the outer wall face (billboards are bigger than lamps) */
const WALL_OUTSET = 3.2;
/** Do not place billboards too close to the gantry / start */
const START_FINISH_CLEARANCE = 18;
/** Minimum gap between billboards */
const MIN_BILLBOARD_SPACING = 22;
/** Minimum clearance to a street lamp (so the pole does not block the panel) */
const MIN_LAMP_CLEARANCE = 5.5;
/** Shifts along the tangent when a station lands behind a pole. First +T (toward the race / "before the pole"), then −T. */
const TANGENT_NUDGES_M = [5, 7, 9, 11, -5, -7, -9] as const;
/** Default number of billboards per track */
const DEFAULT_TARGET_COUNT = 5;
/** Slot index holding the "for rent" ad */
const FOR_RENT_SLOT = 2;
/** Night City: for-rent shift along the race direction over the centerline arc (m). The race runs against index growth → target = stationDist − offset. */
const FOR_RENT_NIGHT_CITY_ALONG_TRACK_M = 15;
/** Night City: billboards placed on the side opposite the usual alternation */
const NIGHT_CITY_FLIP_SIDE_ADS = new Set<TBillboardAdId>(['for-rent', 'apex-tires']);

const isInsideAnyZone = (x: number, z: number, zones: TOrientedBox[]): boolean => {
  for (const zone of zones) {
    if (isInsideCheckpoint(x, z, zone)) {
      return true;
    }
  }
  return false;
};

const distanceToStartFinishSq = (x: number, z: number, line: TOrientedBox): number => {
  const dx = x - line.position[0];
  const dz = z - line.position[2];
  return dx * dx + dz * dz;
};

const frameAtEdge = (
  points: TLoopPoint[],
  index: number,
  t: number,
): { px: number; pz: number; nx: number; nz: number; tx: number; tz: number } | null => {
  const pointCount = points.length;
  const current = points[index];
  const next = points[(index + 1) % pointCount];
  if (!current || !next) {
    return null;
  }
  const dx = next.x - current.x;
  const dz = next.z - current.z;
  const len = Math.hypot(dx, dz) || 1;
  const tx = dx / len;
  const tz = dz / len;
  const px = current.x + dx * t;
  const pz = current.z + dz * t;
  let nx = -dz / len;
  let nz = dx / len;
  if (nx * px + nz * pz < 0) {
    nx = -nx;
    nz = -nz;
  }
  return { px, pz, nx, nz, tx, tz };
};

/** Frame (point + normal + tangent) at an arc distance along the centerline (with wrap) */
const frameAtArcDistance = (
  points: TLoopPoint[],
  arcDistance: number,
  perimeter: number,
): { px: number; pz: number; nx: number; nz: number; tx: number; tz: number } | null => {
  if (points.length < 2 || perimeter < 1e-3) {
    return null;
  }
  let target = arcDistance % perimeter;
  if (target < 0) {
    target += perimeter;
  }
  let traveled = 0;
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
    if (target <= traveled + edgeLen) {
      const t = (target - traveled) / edgeLen;
      return frameAtEdge(points, i, t);
    }
    traveled += edgeLen;
  }
  return frameAtEdge(points, points.length - 1, 1);
};

const isFarEnough = (
  x: number,
  z: number,
  placed: TPlacedBillboard[],
  minDist: number,
): boolean => {
  const minSq = minDist * minDist;
  for (const billboard of placed) {
    const dx = billboard.x - x;
    const dz = billboard.z - z;
    if (dx * dx + dz * dz < minSq) {
      return false;
    }
  }
  return true;
};

/** yaw so that local +X faces (towardX, towardZ) on the XZ plane */
const yawToward = (towardX: number, towardZ: number): number => Math.atan2(-towardZ, towardX);

const perimeterOf = (points: TLoopPoint[]): number => {
  let perimeter = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (!a || !b) {
      continue;
    }
    perimeter += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return perimeter;
};

const canPlaceAt = (
  x: number,
  z: number,
  config: TTrackConfig,
  placed: TPlacedBillboard[],
  startFinishClearanceSq: number,
  lamps: readonly TPlacedStreetLamp[],
): boolean => {
  if (isInsideAnyZone(x, z, config.treeExclusionZones)) {
    return false;
  }
  if (distanceToStartFinishSq(x, z, config.startFinishLine) < startFinishClearanceSq) {
    return false;
  }
  if (!isFarEnough(x, z, placed, MIN_BILLBOARD_SPACING)) {
    return false;
  }
  const minLampSq = MIN_LAMP_CLEARANCE * MIN_LAMP_CLEARANCE;
  for (const lamp of lamps) {
    const dx = lamp.x - x;
    const dz = lamp.z - z;
    if (dx * dx + dz * dz < minLampSq) {
      return false;
    }
  }
  return true;
};

/** Deterministic adId for a slot: exactly one for-rent */
const adIdForSlot = (slotIndex: number, targetCount: number): TBillboardAdId => {
  const brandAds = BILLBOARD_AD_IDS.filter((id) => id !== 'for-rent');
  if (slotIndex === Math.min(FOR_RENT_SLOT, targetCount - 1)) {
    return 'for-rent';
  }
  // Shift the brand index when the slot comes after for-rent
  const brandIndex = slotIndex < FOR_RENT_SLOT ? slotIndex : slotIndex - 1;
  return brandAds[brandIndex % brandAds.length]!;
};

/** Single pass along the centerline with the given station spacing */
const collectAlongCenterline = (
  config: TTrackConfig,
  spacing: number,
  phase: number,
  targetCount: number,
  placed: TPlacedBillboard[],
  startFinishClearanceSq: number,
  lamps: readonly TPlacedStreetLamp[],
): void => {
  const points = config.centerline;
  const perimeter = perimeterOf(points);
  const wallOffset = config.roadWidth / 2 + WALL_THICKNESS + WALL_OUTSET;
  let nextDist = spacing * phase;
  let traveled = 0;
  let stationIndex = 0;

  for (let i = 0; i < points.length; i += 1) {
    if (placed.length >= targetCount) {
      return;
    }
    const current = points[i];
    const next = points[(i + 1) % points.length];
    if (!current || !next) {
      continue;
    }
    const edgeLen = Math.hypot(next.x - current.x, next.z - current.z);
    if (edgeLen < 1e-6) {
      continue;
    }

    while (nextDist <= traveled + edgeLen && placed.length < targetCount) {
      const t = (nextDist - traveled) / edgeLen;
      let frame = frameAtEdge(points, i, t);
      const slotIndex = placed.length;
      const isForRentSlot = slotIndex === Math.min(FOR_RENT_SLOT, targetCount - 1);
      /** Night City for-rent: shift along the centerline arc toward the race (−T) */
      if (frame && isForRentSlot && config.slug === TRACK_SLUG_NIGHT_CITY) {
        frame = frameAtArcDistance(points, nextDist - FOR_RENT_NIGHT_CITY_ALONG_TRACK_M, perimeter);
      }
      if (frame) {
        const { px, pz, nx, nz, tx, tz } = frame;
        const adId = adIdForSlot(slotIndex, targetCount);
        // Night City: certain billboards on the side opposite the usual alternation
        let preferOuter = stationIndex % 2 === 0;
        if (config.slug === TRACK_SLUG_NIGHT_CITY && NIGHT_CITY_FLIP_SIDE_ADS.has(adId)) {
          preferOuter = !preferOuter;
        }
        const sideOrder: readonly { sx: number; sz: number; sideSign: 1 | -1 }[] = preferOuter
          ? [
              { sx: nx, sz: nz, sideSign: 1 },
              { sx: -nx, sz: -nz, sideSign: -1 },
            ]
          : [
              { sx: -nx, sz: -nz, sideSign: -1 },
              { sx: nx, sz: nz, sideSign: 1 },
            ];

        let placedHere = false;
        for (const { sx, sz, sideSign } of sideOrder) {
          const baseX = px + sx * wallOffset;
          const baseZ = pz + sz * wallOffset;
          const candidates: readonly { x: number; z: number }[] = [
            { x: baseX, z: baseZ },
            ...TANGENT_NUDGES_M.map((delta) => ({
              x: baseX + tx * delta,
              z: baseZ + tz * delta,
            })),
          ];

          for (const { x, z } of candidates) {
            if (!canPlaceAt(x, z, config, placed, startFinishClearanceSq, lamps)) {
              continue;
            }
            // Panel normal = centerline tangent (index growth).
            // The race runs against index growth → the billboard faces the oncoming cars.
            placed.push({
              x,
              z,
              rotationY: yawToward(tx, tz),
              sideSign,
              adId,
            });
            placedHere = true;
            break;
          }
          if (placedHere) {
            break;
          }
        }
      }
      stationIndex += 1;
      nextDist += spacing;
    }

    traveled += edgeLen;
  }
};

/** Places roadside billboards along the track. Works day and night; target count is around 5, one of them for-rent. */
export const placeBillboards = ({
  config,
  targetCount = DEFAULT_TARGET_COUNT,
}: TPlaceBillboardsOptions): TPlacedBillboard[] => {
  const points = config.centerline;
  if (points.length < 2 || targetCount <= 0) {
    return [];
  }

  const perimeter = perimeterOf(points);
  if (perimeter < 1e-3) {
    return [];
  }

  const startFinishClearanceSq = START_FINISH_CLEARANCE * START_FINISH_CLEARANCE;
  const placed: TPlacedBillboard[] = [];
  const lamps = placeStreetLamps({ config });

  // Main pass + a denser fallback in case exclusion zones / lamps ate the slots
  const primarySpacing = perimeter / (targetCount + 0.35);
  collectAlongCenterline(
    config,
    primarySpacing,
    0.28,
    targetCount,
    placed,
    startFinishClearanceSq,
    lamps,
  );

  if (placed.length < targetCount) {
    const denseSpacing = perimeter / (targetCount * 2.2);
    collectAlongCenterline(
      config,
      denseSpacing,
      0.12,
      targetCount,
      placed,
      startFinishClearanceSq,
      lamps,
    );
  }

  return placed;
};

/** Constants exported for tests */
export const BILLBOARD_PLACEMENT = {
  defaultTargetCount: DEFAULT_TARGET_COUNT,
  wallOutset: WALL_OUTSET,
  wallThickness: WALL_THICKNESS,
  startFinishClearance: START_FINISH_CLEARANCE,
  minBillboardSpacing: MIN_BILLBOARD_SPACING,
  minLampClearance: MIN_LAMP_CLEARANCE,
  forRentSlot: FOR_RENT_SLOT,
  forRentNightCityAlongTrackM: FOR_RENT_NIGHT_CITY_ALONG_TRACK_M,
} as const;

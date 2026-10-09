import { describe, expect, it } from 'vitest';
import { coastalOvalTrack, getAllTrackConfigs, nightCityTrack, stormEightTrack } from './config';
import type { TLoopPoint } from './config.types';
import { isInsideCheckpoint } from './oriented-box';
import {
  ROW_DEPTH,
  SECTION_PITCH,
  SECTION_WIDTH,
  STAIR_WIDTH,
  TRIBUNE_MARGIN,
  TRIBUNE_ROWS,
  WALL_OFFSET,
  tribuneSideSign,
} from './tribune-layout';

/** Максимальный разрыв между соседними точками centerline (включая замыкание). */
const maxCenterlineGap = (centerline: TLoopPoint[]): number => {
  let maxGap = 0;
  for (let i = 0; i < centerline.length; i += 1) {
    const a = centerline[i]!;
    const b = centerline[(i + 1) % centerline.length]!;
    maxGap = Math.max(maxGap, Math.hypot(b.x - a.x, b.z - a.z));
  }
  return maxGap;
};

/** Средний шаг вдоль centerline. */
const meanCenterlineGap = (centerline: TLoopPoint[]): number => {
  if (centerline.length === 0) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < centerline.length; i += 1) {
    const a = centerline[i]!;
    const b = centerline[(i + 1) % centerline.length]!;
    sum += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return sum / centerline.length;
};

/** Максимальный |Δheading| между соседними сегментами (рад). */
const maxCenterlineTurn = (centerline: TLoopPoint[]): number => {
  let maxTurn = 0;
  const n = centerline.length;
  for (let i = 0; i < n; i += 1) {
    const prev = centerline[(i - 1 + n) % n]!;
    const curr = centerline[i]!;
    const next = centerline[(i + 1) % n]!;
    const a1 = Math.atan2(curr.z - prev.z, curr.x - prev.x);
    const a2 = Math.atan2(next.z - curr.z, next.x - curr.x);
    let delta = a2 - a1;
    while (delta > Math.PI) {
      delta -= Math.PI * 2;
    }
    while (delta < -Math.PI) {
      delta += Math.PI * 2;
    }
    maxTurn = Math.max(maxTurn, Math.abs(delta));
  }
  return maxTurn;
};

describe('track config geometry', () => {
  it('assigns time of day per track theme', () => {
    expect(coastalOvalTrack.timeOfDay).toBe('day');
    expect(nightCityTrack.timeOfDay).toBe('night');
  });

  it('keeps centerline gaps continuous (no stadium jumps)', () => {
    for (const config of getAllTrackConfigs()) {
      const mean = meanCenterlineGap(config.centerline);
      const maxGap = maxCenterlineGap(config.centerline);
      expect(mean).toBeGreaterThan(0);
      // Разрыв не больше ~2.5 средних шагов (раньше Night City имел ~27м при среднем ~4м)
      expect(maxGap).toBeLessThan(mean * 2.5);
    }
  });

  it('keeps centerline heading changes smooth', () => {
    for (const config of getAllTrackConfigs()) {
      // Раньше Night City давал ~49° изломы; плавная трасса укладывается в ~25°
      expect(maxCenterlineTurn(config.centerline)).toBeLessThan((25 * Math.PI) / 180);
    }
  });

  it('uses overlapping wall segments to avoid gaps', () => {
    for (const config of getAllTrackConfigs()) {
      const longWalls = config.walls.filter((wall) => wall.size[2] > 2);
      expect(longWalls.length).toBeGreaterThan(0);
      const minLongWall = Math.min(...longWalls.map((wall) => wall.size[2]));
      expect(minLongWall).toBeGreaterThan(2);
    }
  });

  it('adds corner cap fillers at loop vertices', () => {
    for (const config of getAllTrackConfigs()) {
      const caps = config.walls.filter(
        (wall) => wall.size[0] === wall.size[2] && wall.size[0] < 1.5,
      );
      expect(caps.length).toBeGreaterThan(0);
    }
  });

  it('places start/finish line on the final checkpoint', () => {
    for (const config of getAllTrackConfigs()) {
      const finishCheckpoint = config.checkpoints[config.checkpoints.length - 1];
      expect(config.startFinishLine).toEqual(finishCheckpoint);
    }
  });

  it('keeps finish zone wider than the road for edge crossings', () => {
    for (const config of getAllTrackConfigs()) {
      expect(config.startFinishLine.size[0]).toBeGreaterThanOrEqual(config.roadWidth + 4);
    }
  });

  it('keeps spawn outside the finish checkpoint zone', () => {
    for (const config of getAllTrackConfigs()) {
      const finishCheckpoint = config.checkpoints[config.checkpoints.length - 1];
      expect(finishCheckpoint).toBeDefined();
      if (!finishCheckpoint) {
        continue;
      }
      const spawn = config.spawnPosition;
      expect(isInsideCheckpoint(spawn[0], spawn[2], finishCheckpoint)).toBe(false);
    }
  });

  it('defines tribune side for start grandstands', () => {
    for (const config of getAllTrackConfigs()) {
      expect(['left', 'right']).toContain(config.startTribuneSide);
    }
  });

  it('defines tree exclusion zones around grandstands', () => {
    for (const config of getAllTrackConfigs()) {
      expect(config.treeExclusionZones.length).toBeGreaterThan(0);
      const zone = config.treeExclusionZones[0]!;
      expect(zone.size[0]).toBeGreaterThan(config.roadWidth);
      expect(zone.size[2]).toBeGreaterThan(8);
    }
  });

  it('puts grandstands on the configured side of the car at start and clear of the track', () => {
    for (const config of getAllTrackConfigs()) {
      const line = config.startFinishLine;
      const rotY = line.rotationY;
      // Направление заезда противоположно касательной centerline (race-direction.ts)
      const forwardX = -Math.sin(rotY);
      const forwardZ = -Math.cos(rotY);
      // Левая сторона машины = up × forward
      const leftX = forwardZ;
      const leftZ = -forwardX;

      const zone = config.treeExclusionZones[0]!;
      const toZoneX = zone.position[0] - line.position[0];
      const toZoneZ = zone.position[2] - line.position[2];
      const sideExpect = config.startTribuneSide === 'left' ? 1 : -1;
      expect(sideExpect * (toZoneX * leftX + toZoneZ * leftZ)).toBeGreaterThan(0);

      // Ни одна точка трассы не попадает в пятно трибуны (локаль финишной линии)
      const sign = tribuneSideSign(config.startTribuneSide);
      const innerX = sign * (config.roadWidth / 2 + WALL_OFFSET + TRIBUNE_MARGIN);
      const backX = innerX + sign * TRIBUNE_ROWS * ROW_DEPTH;
      const minX = Math.min(innerX, backX);
      const maxX = Math.max(innerX, backX);
      const spanZ = SECTION_PITCH + SECTION_WIDTH / 2 + STAIR_WIDTH;

      for (const p of config.centerline) {
        const dx = p.x - line.position[0];
        const dz = p.z - line.position[2];
        const localX = dx * Math.cos(rotY) - dz * Math.sin(rotY);
        const localZ = dx * Math.sin(rotY) + dz * Math.cos(rotY);
        const inside = localX > minX && localX < maxX && Math.abs(localZ) < spanZ;
        expect(inside).toBe(false);
      }
    }
  });

  it('places obstacles on both tracks', () => {
    expect(coastalOvalTrack.obstacles.length).toBeGreaterThan(0);
    expect(nightCityTrack.obstacles.length).toBeGreaterThan(0);
    // Night City: 4 ряда × несколько банков — плотнее Coastal (3 ряда)
    expect(nightCityTrack.obstacles.length).toBeGreaterThan(coastalOvalTrack.obstacles.length);
  });

  it('mixes tire stacks and fuel barrels on both tracks', () => {
    for (const config of [coastalOvalTrack, nightCityTrack]) {
      const kinds = new Set(config.obstacles.map((obstacle) => obstacle.kind));
      expect(kinds.has('tireStack')).toBe(true);
      expect(kinds.has('fuelBarrel')).toBe(true);
    }
  });

  it('keeps obstacles clear of the spawn point', () => {
    const minClearance = 6;
    for (const config of [coastalOvalTrack, nightCityTrack]) {
      const spawn = config.spawnPosition;
      for (const obstacle of config.obstacles) {
        const dx = obstacle.position[0] - spawn[0];
        const dz = obstacle.position[2] - spawn[2];
        const distance = Math.hypot(dx, dz);
        const obstacleRadius = Math.hypot(obstacle.size[0], obstacle.size[2]) / 2;
        expect(distance - obstacleRadius).toBeGreaterThan(minClearance);
      }
    }
  });

  it('places two oil slicks on each track', () => {
    for (const config of [coastalOvalTrack, nightCityTrack]) {
      expect(config.oilSlicks).toHaveLength(2);
      for (const slick of config.oilSlicks) {
        expect(slick.size[0]).toBeGreaterThan(1.5);
        expect(slick.size[0]).toBeLessThan(3);
        expect(slick.size[2]).toBeGreaterThan(2);
        expect(slick.size[2]).toBeLessThan(4);
      }
    }
  });

  it('places Night City second oil slick ~70m before the finish on the race approach', () => {
    const finish = nightCityTrack.startFinishLine;
    const spawn = nightCityTrack.spawnPosition;
    const slick = nightCityTrack.oilSlicks[1]!;
    const dx = slick.position[0] - finish.position[0];
    const dz = slick.position[2] - finish.position[2];
    const distance = Math.hypot(dx, dz);
    expect(distance).toBeGreaterThan(60);
    expect(distance).toBeLessThan(80);

    // Подход заезда: сторона спавна (+lz), не «после» линии (−lz)
    const sin = Math.sin(finish.rotationY);
    const cos = Math.cos(finish.rotationY);
    const slickLz = dx * sin + dz * cos;
    const spawnLz =
      (spawn[0] - finish.position[0]) * sin + (spawn[2] - finish.position[2]) * cos;
    expect(spawnLz).toBeGreaterThan(0);
    expect(slickLz).toBeGreaterThan(0);
  });

  it('keeps oil slicks clear of spawn and start/finish', () => {
    const minSpawnClearance = 10;
    for (const config of [coastalOvalTrack, nightCityTrack]) {
      const spawn = config.spawnPosition;
      for (const slick of config.oilSlicks) {
        const dx = slick.position[0] - spawn[0];
        const dz = slick.position[2] - spawn[2];
        const distance = Math.hypot(dx, dz);
        const slickRadius = Math.hypot(slick.size[0], slick.size[2]) / 2;
        expect(distance - slickRadius).toBeGreaterThan(minSpawnClearance);
        expect(isInsideCheckpoint(slick.position[0], slick.position[2], config.startFinishLine)).toBe(
          false,
        );
      }
    }
  });

  it('keeps oil slicks clear of dynamic obstacles', () => {
    const minClearance = 4;
    for (const config of [coastalOvalTrack, nightCityTrack]) {
      for (const slick of config.oilSlicks) {
        const slickRadius = Math.hypot(slick.size[0], slick.size[2]) / 2;
        for (const obstacle of config.obstacles) {
          const dx = slick.position[0] - obstacle.position[0];
          const dz = slick.position[2] - obstacle.position[2];
          const distance = Math.hypot(dx, dz);
          const obstacleRadius = Math.hypot(obstacle.size[0], obstacle.size[2]) / 2;
          expect(distance - slickRadius - obstacleRadius).toBeGreaterThan(minClearance);
        }
      }
    }
  });

  it('raises the storm-eight deck only at the crossing bridge', () => {
    const pts = stormEightTrack.centerline;
    const maxYAt = (from: number, to: number) => {
      let m = 0;
      pts.forEach((p, i) => {
        const frac = i / pts.length;
        if (frac >= from && frac < to) {
          m = Math.max(m, p.y ?? 0);
        }
      });
      return m;
    };
    // Мост на втором посещении узла (~0.625) поднят
    expect(maxYAt(0.6, 0.66)).toBeGreaterThan(3.5);
    // Единственная возвышенная зона: ровно один восход над 0.5 м по замкнутому кольцу
    const raised = pts.map((p) => (p.y ?? 0) > 0.5);
    let rises = 0;
    for (let i = 0; i < raised.length; i += 1) {
      if (raised[i] && !raised[(i - 1 + raised.length) % raised.length]) {
        rises += 1;
      }
    }
    expect(rises).toBe(1);
  });

  it('supports the storm-eight bridge deck with piers under the road', () => {
    const piers = stormEightTrack.piers ?? [];
    // Мост ~50 м при шаге 6 м: минимум несколько колонн + ростверки
    expect(piers.length).toBeGreaterThanOrEqual(6);
    const halfRoad = stormEightTrack.roadWidth / 2;
    const columns = piers.filter((p) => p.size[0] <= stormEightTrack.roadWidth);
    const caps = piers.filter((p) => p.size[0] > stormEightTrack.roadWidth);
    // Есть и колонны, и поперечные ростверки под декой
    expect(columns.length).toBeGreaterThanOrEqual(4);
    expect(caps.length).toBeGreaterThanOrEqual(2);

    for (const pier of piers) {
      // Опора ПОД полотном, а не рядом: ближайшая точка centerline не дальше половины дороги
      let nearest = Infinity;
      for (const p of stormEightTrack.centerline) {
        nearest = Math.min(nearest, Math.hypot(p.x - pier.position[0], p.z - pier.position[2]));
      }
      expect(nearest).toBeLessThanOrEqual(halfRoad);
    }
    for (const col of columns) {
      // Колонна от земли до низа деки
      expect(col.size[1]).toBeGreaterThan(0.5);
      // Колонна держит именно деку: поднятая точка моста прямо над ней
      const underDeck = stormEightTrack.centerline.some(
        (p) => (p.y ?? 0) > 0.9 && Math.hypot(p.x - col.position[0], p.z - col.position[2]) <= halfRoad,
      );
      expect(underDeck).toBe(true);
      // Колонна не стоит на нижней проезжей части (под мостом)
      let nearestLow = Infinity;
      for (const p of stormEightTrack.centerline) {
        if ((p.y ?? 0) < 0.5) {
          nearestLow = Math.min(nearestLow, Math.hypot(p.x - col.position[0], p.z - col.position[2]));
        }
      }
      expect(nearestLow).toBeGreaterThan(halfRoad);
    }
    // Ростверк лежит под низом деки, а не на уровне асфальта
    for (const cap of caps) {
      expect(cap.position[1]).toBeLessThan(3.9);
    }
    // Плоские трассы без эстакады — без опор
    expect(coastalOvalTrack.piers ?? []).toHaveLength(0);
    expect(nightCityTrack.piers ?? []).toHaveLength(0);
  });
});

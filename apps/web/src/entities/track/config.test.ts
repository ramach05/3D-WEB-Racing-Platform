import { describe, expect, it } from 'vitest';
import { coastalOvalTrack, getAllTrackConfigs, nightCityTrack } from './config';
import type { TLoopPoint } from './config.types';
import { isInsideCheckpoint } from './oriented-box';

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
      expect(config.startTribuneSide).toBe('left');
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

  it('places sparse obstacles on night city and denser ones on coastal', () => {
    expect(coastalOvalTrack.obstacles.length).toBeGreaterThan(0);
    expect(nightCityTrack.obstacles.length).toBeGreaterThan(0);
    expect(nightCityTrack.obstacles.length).toBeLessThan(coastalOvalTrack.obstacles.length);
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
});

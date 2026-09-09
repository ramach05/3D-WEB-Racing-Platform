import { describe, expect, it } from 'vitest';
import { coastalOvalTrack, getAllTrackConfigs, nightCityTrack } from './config';
import { isInsideCheckpoint } from './oriented-box';

describe('track config geometry', () => {
  it('assigns time of day per track theme', () => {
    expect(coastalOvalTrack.timeOfDay).toBe('day');
    expect(nightCityTrack.timeOfDay).toBe('night');
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

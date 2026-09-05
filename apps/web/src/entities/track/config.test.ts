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

  it('places obstacles only on the daytime coastal track', () => {
    expect(coastalOvalTrack.obstacles.length).toBeGreaterThan(0);
    expect(nightCityTrack.obstacles).toEqual([]);
  });

  it('uses only tire stacks as coastal obstacles', () => {
    expect(coastalOvalTrack.obstacles.every((obstacle) => obstacle.kind === 'tireStack')).toBe(
      true,
    );
  });

  it('keeps coastal obstacles clear of the spawn point', () => {
    const spawn = coastalOvalTrack.spawnPosition;
    const minClearance = 6;
    for (const obstacle of coastalOvalTrack.obstacles) {
      const dx = obstacle.position[0] - spawn[0];
      const dz = obstacle.position[2] - spawn[2];
      const distance = Math.hypot(dx, dz);
      const obstacleRadius = Math.hypot(obstacle.size[0], obstacle.size[2]) / 2;
      expect(distance - obstacleRadius).toBeGreaterThan(minClearance);
    }
  });
});

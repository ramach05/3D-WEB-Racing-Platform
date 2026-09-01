import { describe, expect, it } from 'vitest';
import { coastalOvalTrack, getAllTrackConfigs, nightCityTrack } from './config';

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
});

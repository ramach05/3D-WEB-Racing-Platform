import { describe, expect, it } from 'vitest';
import { coastalOvalTrack, nightCityTrack } from '@/entities/track';
import {
  crossedFinishLine,
  crossedFinishPlane,
  getTrackLineLocalCoords,
  isInsideFinishZone,
  passedFinishLine,
  passedFinishLineForward,
} from './checkpoint-rules';

describe('crossedFinishLine', () => {
  it('detects crossing toward +lz within track width', () => {
    const line = coastalOvalTrack.startFinishLine;
    const sin = Math.sin(line.rotationY);
    const cos = Math.cos(line.rotationY);

    expect(
      crossedFinishLine(
        line.position[0] - sin * 2,
        line.position[2] - cos * 2,
        line.position[0] + sin * 2,
        line.position[2] + cos * 2,
        line,
      ),
    ).toBe(true);
  });

  it('detects crossing toward -lz within track width', () => {
    const line = coastalOvalTrack.startFinishLine;
    const sin = Math.sin(line.rotationY);
    const cos = Math.cos(line.rotationY);

    expect(
      crossedFinishLine(
        line.position[0] + sin * 2,
        line.position[2] + cos * 2,
        line.position[0] - sin * 2,
        line.position[2] - cos * 2,
        line,
      ),
    ).toBe(true);
  });

  it('ignores crossing outside track width', () => {
    const line = coastalOvalTrack.startFinishLine;
    const sin = Math.sin(line.rotationY);
    const cos = Math.cos(line.rotationY);
    const across = line.size[0];

    expect(
      crossedFinishLine(
        line.position[0] - sin * 2 + cos * across,
        line.position[2] - cos * 2 + sin * across,
        line.position[0] + sin * 2 + cos * across,
        line.position[2] + cos * 2 + sin * across,
        line,
      ),
    ).toBe(false);
  });

  it('places spawn past the finish line on +lz side', () => {
    const line = coastalOvalTrack.startFinishLine;
    const spawn = coastalOvalTrack.spawnPosition;
    expect(getTrackLineLocalCoords(spawn[0], spawn[2], line).lz).toBeGreaterThan(0);
  });
});

describe('crossedFinishPlane', () => {
  it('detects lz sign change within finish width', () => {
    const line = nightCityTrack.startFinishLine;
    const sin = Math.sin(line.rotationY);
    const cos = Math.cos(line.rotationY);
    const acrossX = Math.cos(line.rotationY);
    const acrossZ = -Math.sin(line.rotationY);
    const edge = line.size[0] / 2 - 0.5;

    expect(
      crossedFinishPlane(
        line.position[0] - sin * 2 + acrossX * edge,
        line.position[2] - cos * 2 + acrossZ * edge,
        line.position[0] + sin * 2 + acrossX * edge,
        line.position[2] + cos * 2 + acrossZ * edge,
        line,
      ),
    ).toBe(true);
  });
});

describe('isInsideFinishZone', () => {
  it('contains the finish center and keeps spawn outside', () => {
    for (const config of [coastalOvalTrack, nightCityTrack]) {
      const line = config.startFinishLine;
      expect(isInsideFinishZone(line.position[0], line.position[2], line)).toBe(true);
      expect(isInsideFinishZone(config.spawnPosition[0], config.spawnPosition[2], line)).toBe(
        false,
      );
    }
  });
});

describe('passedFinishLine', () => {
  it('detects a centerline wrap across the finish', () => {
    const config = coastalOvalTrack;
    const line = config.startFinishLine;
    const points = config.centerline;
    const before = points[points.length - 1]!;
    const after = points[1]!;
    expect(passedFinishLine(before.x, before.z, after.x, after.z, line)).toBe(true);
  });
});

describe('passedFinishLineForward', () => {
  // Заезд: lz + → − (от спавна); обратное — не круг. См. race-direction.ts.
  it('accepts race-direction crossing (+lz → -lz)', () => {
    const line = coastalOvalTrack.startFinishLine;
    const sin = Math.sin(line.rotationY);
    const cos = Math.cos(line.rotationY);

    expect(
      passedFinishLineForward(
        line.position[0] + sin * 2,
        line.position[2] + cos * 2,
        line.position[0] - sin * 2,
        line.position[2] - cos * 2,
        line,
      ),
    ).toBe(true);
  });

  it('rejects reverse crossing (-lz → +lz)', () => {
    const line = coastalOvalTrack.startFinishLine;
    const sin = Math.sin(line.rotationY);
    const cos = Math.cos(line.rotationY);

    expect(
      passedFinishLineForward(
        line.position[0] - sin * 2,
        line.position[2] - cos * 2,
        line.position[0] + sin * 2,
        line.position[2] + cos * 2,
        line,
      ),
    ).toBe(false);
  });

  it('detects race-direction wrap across the finish (after → before)', () => {
    const config = coastalOvalTrack;
    const line = config.startFinishLine;
    const points = config.centerline;
    const before = points[points.length - 1]!;
    const after = points[1]!;
    expect(passedFinishLineForward(after.x, after.z, before.x, before.z, line)).toBe(true);
  });
});

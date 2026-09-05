import { describe, expect, it } from 'vitest';
import { coastalOvalTrack } from '@/entities/track';
import { crossedFinishLine, getTrackLineLocalCoords } from './checkpoint-rules';

describe('crossedFinishLine', () => {
  it('detects forward crossing within track width', () => {
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

  it('detects backward crossing within track width', () => {
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

  it('places spawn past the finish line', () => {
    const line = coastalOvalTrack.startFinishLine;
    const spawn = coastalOvalTrack.spawnPosition;
    expect(getTrackLineLocalCoords(spawn[0], spawn[2], line).lz).toBeGreaterThan(0);
  });
});

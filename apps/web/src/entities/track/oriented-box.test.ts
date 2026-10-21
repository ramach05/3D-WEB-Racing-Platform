import { describe, expect, it } from 'vitest';
import { coastalOvalTrack, isInsideCheckpoint } from '@/entities/track';

describe('isInsideCheckpoint', () => {
  it('detects center of checkpoint box', () => {
    const checkpoint = coastalOvalTrack.checkpoints[0]!;
    expect(isInsideCheckpoint(checkpoint.position[0], checkpoint.position[2], checkpoint)).toBe(
      true,
    );
  });

  it('ignores spawn position for distant checkpoints', () => {
    const spawn = coastalOvalTrack.spawnPosition;
    for (const checkpoint of coastalOvalTrack.checkpoints) {
      expect(isInsideCheckpoint(spawn[0], spawn[2], checkpoint)).toBe(false);
    }
  });
});

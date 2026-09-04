import { afterEach, describe, expect, it } from 'vitest';
import { getRaceHudSnapshot, registerCheckpoint, resetRaceSession, startRacing } from './store';

describe('registerCheckpoint multi-lap', () => {
  afterEach(() => {
    resetRaceSession('track-test', 4, 3);
  });

  it('advances checkpoints within a lap without finishing', () => {
    resetRaceSession('track-test', 4, 3);
    startRacing();

    expect(registerCheckpoint(0)).toBe(false);
    expect(getRaceHudSnapshot().checkpointIndex).toBe(1);
    expect(getRaceHudSnapshot().lapIndex).toBe(0);

    expect(registerCheckpoint(1)).toBe(false);
    expect(registerCheckpoint(2)).toBe(false);
    expect(getRaceHudSnapshot().checkpointIndex).toBe(3);
  });

  it('starts the next lap after the finish line until the last lap', () => {
    resetRaceSession('track-test', 4, 3);
    startRacing();

    for (let lap = 0; lap < 2; lap += 1) {
      expect(registerCheckpoint(0)).toBe(false);
      expect(registerCheckpoint(1)).toBe(false);
      expect(registerCheckpoint(2)).toBe(false);
      expect(registerCheckpoint(3)).toBe(false);
      expect(getRaceHudSnapshot().lapIndex).toBe(lap + 1);
      expect(getRaceHudSnapshot().checkpointIndex).toBe(0);
    }
  });

  it('finishes only after all laps are complete', () => {
    resetRaceSession('track-test', 4, 3);
    startRacing();

    for (let i = 0; i < 11; i += 1) {
      expect(registerCheckpoint(i % 4)).toBe(false);
    }

    expect(getRaceHudSnapshot().lapIndex).toBe(2);
    expect(getRaceHudSnapshot().checkpointIndex).toBe(3);
    expect(registerCheckpoint(3)).toBe(true);
    expect(getRaceHudSnapshot().lapIndex).toBe(3);
    expect(getRaceHudSnapshot().checkpointIndex).toBe(4);
  });
});

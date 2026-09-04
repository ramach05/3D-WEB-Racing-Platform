import { describe, expect, it } from 'vitest';
import {
  advanceLapProgress,
  coastalOvalTrack,
  getTrackProgress,
  nightCityTrack,
} from '@/entities/track';
import {
  getRaceHudSnapshot,
  registerLapComplete,
  resetRaceSession,
  startRacing,
} from '@/features/race-session';
import {
  MIN_LAP_PROGRESS,
  passedFinishLine,
  START_FINISH_COOLDOWN_RATIO,
} from './checkpoint-detector';

const driveCenterline = (
  config: typeof coastalOvalTrack,
  onStep: (prev: { x: number; z: number } | null, curr: { x: number; z: number }) => void,
  stepsPerSegment = 20,
) => {
  const points = config.centerline;
  let prev: { x: number; z: number } | null = { x: points[0]!.x, z: points[0]!.z };

  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length]!;
    for (let s = 1; s <= stepsPerSegment; s += 1) {
      const t = s / stepsPerSegment;
      const curr = {
        x: points[i]!.x + (next.x - points[i]!.x) * t,
        z: points[i]!.z + (next.z - points[i]!.z) * t,
      };
      onStep(prev, curr);
      prev = curr;
    }
  }
};

const simulateRaceLaps = (
  config: typeof coastalOvalTrack,
  lapTotal: number,
  stepsPerSegment = 20,
): { lapsCompleted: number; raceFinished: boolean } => {
  resetRaceSession('sim-track', config.checkpoints.length, lapTotal);
  startRacing();

  const line = config.startFinishLine;
  let raceFinished = false;
  let maxProgress = 0;
  let lapCooldown = true;

  for (let lap = 0; lap < lapTotal && !raceFinished; lap += 1) {
    driveCenterline(
      config,
      (prev, curr) => {
        if (raceFinished) {
          return;
        }

        const { ratio } = getTrackProgress(curr.x, curr.z, config.centerline);
        maxProgress = advanceLapProgress(maxProgress, ratio);

        if (ratio > START_FINISH_COOLDOWN_RATIO) {
          lapCooldown = false;
        }

        const crossed = passedFinishLine(prev?.x ?? null, prev?.z ?? null, curr.x, curr.z, line);
        if (!crossed || lapCooldown || maxProgress < MIN_LAP_PROGRESS) {
          return;
        }

        lapCooldown = true;
        maxProgress = ratio;
        raceFinished = registerLapComplete();
      },
      stepsPerSegment,
    );
  }

  return {
    lapsCompleted: getRaceHudSnapshot().lapIndex,
    raceFinished,
  };
};

describe('track progress', () => {
  it('returns ratio along coastal oval centerline', () => {
    const start = coastalOvalTrack.centerline[0]!;
    const progress = getTrackProgress(start.x, start.z, coastalOvalTrack.centerline);
    expect(progress.ratio).toBeGreaterThanOrEqual(0);
    expect(progress.ratio).toBeLessThan(0.05);
  });

  it('keeps max progress when wrapping past start', () => {
    expect(advanceLapProgress(0.92, 0.03)).toBe(0.92);
  });
});

describe('multi-lap race simulation', () => {
  it('completes 3 laps on coastal oval', () => {
    const result = simulateRaceLaps(coastalOvalTrack, 3);
    expect(result.lapsCompleted).toBe(3);
    expect(result.raceFinished).toBe(true);
  });

  it('completes 3 laps on night city', () => {
    const result = simulateRaceLaps(nightCityTrack, 3);
    expect(result.lapsCompleted).toBe(3);
    expect(result.raceFinished).toBe(true);
  });

  it('does not count lap without enough progress', () => {
    resetRaceSession('sim-track', coastalOvalTrack.checkpoints.length, 3);
    startRacing();

    const line = coastalOvalTrack.startFinishLine;
    let maxProgress = 0;
    let lapCooldown = true;

    driveCenterline(
      coastalOvalTrack,
      (prev, curr) => {
        const { ratio } = getTrackProgress(curr.x, curr.z, coastalOvalTrack.centerline);
        if (ratio > 0.08) {
          return;
        }
        maxProgress = advanceLapProgress(maxProgress, ratio);
        if (ratio > START_FINISH_COOLDOWN_RATIO) {
          lapCooldown = false;
        }
        const crossed = passedFinishLine(prev?.x ?? null, prev?.z ?? null, curr.x, curr.z, line);
        if (crossed && !lapCooldown && maxProgress >= MIN_LAP_PROGRESS) {
          registerLapComplete();
        }
      },
      20,
    );

    expect(maxProgress).toBeLessThan(MIN_LAP_PROGRESS);
    expect(getRaceHudSnapshot().lapIndex).toBe(0);
  });
});

describe('registerLapComplete', () => {
  it('increments lap counter until race finish', () => {
    resetRaceSession('sim-track', 4, 3);
    startRacing();

    expect(registerLapComplete()).toBe(false);
    expect(getRaceHudSnapshot().lapIndex).toBe(1);

    expect(registerLapComplete()).toBe(false);
    expect(getRaceHudSnapshot().lapIndex).toBe(2);

    expect(registerLapComplete()).toBe(true);
    expect(getRaceHudSnapshot().lapIndex).toBe(3);
  });
});

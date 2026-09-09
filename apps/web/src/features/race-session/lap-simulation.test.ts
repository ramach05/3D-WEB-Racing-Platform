import { describe, expect, it } from 'vitest';
import {
  accumulateLapTravel,
  advanceLapProgress,
  coastalOvalTrack,
  getTrackProgress,
  isRaceLapCooldownCleared,
  nightCityTrack,
} from '@/entities/track';
import {
  canRegisterLapCrossing,
  getRaceHudSnapshot,
  getTrackLineLocalCoords,
  MIN_LAP_PROGRESS,
  passedFinishLineForward,
  registerLapComplete,
  resetRaceSession,
  START_FINISH_COOLDOWN_RATIO,
  startRacing,
} from '@/features/race-session';

type TPoint = { x: number; z: number };

/**
 * Симуляция пути в направлении заезда (против роста индекса centerline),
 * как `spawnRotationY` / стрелки — см. `race-direction.ts`.
 */
const driveOffsetPath = (
  config: typeof coastalOvalTrack,
  lateralOffset: number,
  onStep: (prev: TPoint | null, curr: TPoint) => void,
  lapsToDrive: number,
  stepsPerSegment = 8,
) => {
  const points = config.centerline;
  let prev: TPoint | null = null;
  let i = points.length - 2;
  let s = stepsPerSegment;
  const totalSteps = lapsToDrive * points.length * stepsPerSegment;

  for (let step = 0; step < totalSteps; step += 1) {
    const a = points[i]!;
    const prevIndex = (i - 1 + points.length) % points.length;
    const b = points[prevIndex]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    const t = s / stepsPerSegment;
    const curr = {
      x: a.x + dx * t + nx * lateralOffset,
      z: a.z + dz * t + nz * lateralOffset,
    };
    onStep(prev, curr);
    prev = curr;
    s -= 1;
    if (s < 1) {
      s = stepsPerSegment;
      i = prevIndex;
    }
  }
};

/** Симуляция как в CheckpointDetector. */
const simulateRaceLaps = (
  config: typeof coastalOvalTrack,
  lapTotal: number,
  lateralOffset = 0,
  stepsPerSegment = 8,
): { lapsCompleted: number; raceFinished: boolean } => {
  resetRaceSession('sim-track', config.checkpoints.length, lapTotal);
  startRacing();

  const line = config.startFinishLine;
  let raceFinished = false;
  let lapTravel = 0;
  let lastRatio: number | null = null;
  let lapCooldown = true;

  driveOffsetPath(
    config,
    lateralOffset,
    (prev, curr) => {
      if (raceFinished) {
        return;
      }

      const { ratio } = getTrackProgress(curr.x, curr.z, config.centerline);
      const travel = accumulateLapTravel(lapTravel, lastRatio, ratio);
      lapTravel = travel.lapTravel;
      lastRatio = travel.lastRatio;

      if (isRaceLapCooldownCleared(ratio, START_FINISH_COOLDOWN_RATIO)) {
        lapCooldown = false;
      }

      const crossed = passedFinishLineForward(
        prev?.x ?? null,
        prev?.z ?? null,
        curr.x,
        curr.z,
        line,
      );
      if (!canRegisterLapCrossing(crossed, lapCooldown, lapTravel)) {
        return;
      }

      lapCooldown = true;
      lapTravel = 0;
      lastRatio = ratio;
      raceFinished = registerLapComplete();
    },
    lapTotal,
    stepsPerSegment,
  );

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

  it('completes 3 laps on coastal oval with inward offset', () => {
    const result = simulateRaceLaps(coastalOvalTrack, 3, -4);
    expect(result.lapsCompleted).toBe(3);
    expect(result.raceFinished).toBe(true);
  });

  it('completes 3 laps on night city with outer-edge offset', () => {
    const result = simulateRaceLaps(nightCityTrack, 3, 4);
    expect(result.lapsCompleted).toBe(3);
    expect(result.raceFinished).toBe(true);
  });

  it('does not count lap without enough progress', () => {
    resetRaceSession('sim-track', coastalOvalTrack.checkpoints.length, 3);
    startRacing();

    const line = coastalOvalTrack.startFinishLine;
    let lapTravel = 0;
    let lastRatio: number | null = null;
    let lapCooldown = true;

    driveOffsetPath(
      coastalOvalTrack,
      0,
      (prev, curr) => {
        const { ratio } = getTrackProgress(curr.x, curr.z, coastalOvalTrack.centerline);
        if (ratio > 0.08 && ratio < 0.95) {
          return;
        }
        const travel = accumulateLapTravel(lapTravel, lastRatio, ratio);
        lapTravel = travel.lapTravel;
        lastRatio = travel.lastRatio;
        if (isRaceLapCooldownCleared(ratio, START_FINISH_COOLDOWN_RATIO)) {
          lapCooldown = false;
        }
        const crossed = passedFinishLineForward(
          prev?.x ?? null,
          prev?.z ?? null,
          curr.x,
          curr.z,
          line,
        );
        if (canRegisterLapCrossing(crossed, lapCooldown, lapTravel)) {
          registerLapComplete();
        }
      },
      1,
      8,
    );

    expect(lapTravel).toBeLessThan(MIN_LAP_PROGRESS);
    expect(getRaceHudSnapshot().lapIndex).toBe(0);
  });

  it('does not count lap when crossing finish backward after enough progress', () => {
    resetRaceSession('sim-track', coastalOvalTrack.checkpoints.length, 3);
    startRacing();

    const line = coastalOvalTrack.startFinishLine;
    let lapTravel = 0;
    let lastRatio: number | null = null;
    let lapCooldown = true;
    let reachedProgress = false;

    driveOffsetPath(
      coastalOvalTrack,
      0,
      (_prev, curr) => {
        if (reachedProgress) {
          return;
        }
        const { ratio } = getTrackProgress(curr.x, curr.z, coastalOvalTrack.centerline);
        const travel = accumulateLapTravel(lapTravel, lastRatio, ratio);
        lapTravel = travel.lapTravel;
        lastRatio = travel.lastRatio;
        if (isRaceLapCooldownCleared(ratio, START_FINISH_COOLDOWN_RATIO)) {
          lapCooldown = false;
        }
        if (lapTravel >= MIN_LAP_PROGRESS) {
          reachedProgress = true;
        }
      },
      1,
      8,
    );

    expect(reachedProgress).toBe(true);
    expect(lapCooldown).toBe(false);

    const sin = Math.sin(line.rotationY);
    const cos = Math.cos(line.rotationY);
    const after = {
      x: line.position[0] + sin * 2,
      z: line.position[2] + cos * 2,
    };
    const before = {
      x: line.position[0] - sin * 2,
      z: line.position[2] - cos * 2,
    };

    expect(getTrackLineLocalCoords(after.x, after.z, line).lz).toBeGreaterThan(0);
    expect(getTrackLineLocalCoords(before.x, before.z, line).lz).toBeLessThan(0);

    // Обратный проезд: -lz → +lz
    const crossed = passedFinishLineForward(before.x, before.z, after.x, after.z, line);
    expect(crossed).toBe(false);
    expect(canRegisterLapCrossing(crossed, lapCooldown, lapTravel)).toBe(false);
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

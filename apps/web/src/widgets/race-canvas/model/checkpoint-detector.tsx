import { type RefObject, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RapierRigidBody } from '@react-three/rapier';
import type { TTrackConfig } from '@/entities/track';
import { accumulateLapTravel, getTrackProgress, isRaceLapCooldownCleared } from '@/entities/track';
import {
  canRegisterLapCrossing,
  getRaceHudSnapshot,
  passedFinishLineForward,
  registerLapComplete,
  START_FINISH_COOLDOWN_RATIO,
} from '@/features/race-session';

type TCheckpointDetectorProps = {
  /** Track config (centerline, finish) */
  config: TTrackConfig;
  /** Ref to the vehicle physics body */
  bodyRef: RefObject<RapierRigidBody | null>;
  /** Restart counter — resets lap progress */
  resetNonce: number;
  /** Callback when the race finishes */
  onFinished: () => void;
};

/**
 * Lap detector aligned with the race direction (see `race-direction.ts`):
 * travel over decreasing ratio + finish only on `lz + → −`.
 * continuityWindow: for figure-8 — prevents counting a flight/jump as progress.
 */
export const CheckpointDetector = ({
  config,
  bodyRef,
  resetNonce,
  onFinished,
}: TCheckpointDetectorProps) => {
  const prevPosRef = useRef<{ x: number; z: number } | null>(null);
  const lapTravelRef = useRef(0);
  const lastRatioRef = useRef<number | null>(null);
  const lapCooldownRef = useRef(true);
  const resetNonceRef = useRef(resetNonce);
  const continuityWindowRef = useRef<number | null>(null);

  useFrame(() => {
    if (resetNonceRef.current !== resetNonce) {
      resetNonceRef.current = resetNonce;
      prevPosRef.current = null;
      lapTravelRef.current = 0;
      lastRatioRef.current = null;
      lapCooldownRef.current = true;
      continuityWindowRef.current = null;
    }

    const body = bodyRef.current;
    if (!body) {
      return;
    }
    if (getRaceHudSnapshot().status !== 'racing') {
      prevPosRef.current = null;
      return;
    }

    const { x, z } = body.translation();
    const prevPos = prevPosRef.current;
    const { ratio } = getTrackProgress(x, z, config.centerline);

    let adjustedRatio = ratio;
    const cw = continuityWindowRef.current;
    if (cw !== null && cw !== ratio) {
      const jump = Math.abs(ratio - cw);
      if (jump < 0.15) {
        adjustedRatio = cw;
      } else {
        continuityWindowRef.current = ratio;
      }
    } else if (cw === null) {
      continuityWindowRef.current = ratio;
    }

    const travel = accumulateLapTravel(lapTravelRef.current, lastRatioRef.current, adjustedRatio);
    lapTravelRef.current = travel.lapTravel;
    lastRatioRef.current = travel.lastRatio;
    const progress = lapTravelRef.current;

    if (isRaceLapCooldownCleared(ratio, START_FINISH_COOLDOWN_RATIO)) {
      lapCooldownRef.current = false;
    }

    const crossed = passedFinishLineForward(
      prevPos?.x ?? null,
      prevPos?.z ?? null,
      x,
      z,
      config.startFinishLine,
    );

    prevPosRef.current = { x, z };

    if (!canRegisterLapCrossing(crossed, lapCooldownRef.current, progress)) {
      return;
    }

    lapCooldownRef.current = true;
    lapTravelRef.current = 0;
    lastRatioRef.current = ratio;

    const finished = registerLapComplete();
    prevPosRef.current = null;
    continuityWindowRef.current = null;

    if (finished) {
      onFinished();
    }
  });

  return null;
};

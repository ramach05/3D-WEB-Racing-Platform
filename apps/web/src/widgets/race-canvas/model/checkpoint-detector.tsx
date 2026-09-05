import { type RefObject, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RapierRigidBody } from '@react-three/rapier';
import type { TrackConfig } from '@/entities/track';
import { advanceLapProgress, getTrackProgress } from '@/entities/track';
import {
  canRegisterLapCrossing,
  getRaceHudSnapshot,
  passedFinishLine,
  registerLapComplete,
  START_FINISH_COOLDOWN_RATIO,
} from '@/features/race-session';

type CheckpointDetectorProps = {
  config: TrackConfig;
  bodyRef: RefObject<RapierRigidBody | null>;
  resetNonce: number;
  onFinished: () => void;
};

/** Детектор кругов: финишная линия + прогресс по centerline. */
export const CheckpointDetector = ({
  config,
  bodyRef,
  resetNonce,
  onFinished,
}: CheckpointDetectorProps) => {
  const prevPosRef = useRef<{ x: number; z: number } | null>(null);
  const maxProgressRef = useRef(0);
  const lapCooldownRef = useRef(true);
  const resetNonceRef = useRef(resetNonce);

  useFrame(() => {
    if (resetNonceRef.current !== resetNonce) {
      resetNonceRef.current = resetNonce;
      prevPosRef.current = null;
      maxProgressRef.current = 0;
      lapCooldownRef.current = true;
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

    maxProgressRef.current = advanceLapProgress(maxProgressRef.current, ratio);

    if (ratio > START_FINISH_COOLDOWN_RATIO) {
      lapCooldownRef.current = false;
    }

    const crossed = passedFinishLine(
      prevPos?.x ?? null,
      prevPos?.z ?? null,
      x,
      z,
      config.startFinishLine,
    );

    prevPosRef.current = { x, z };

    if (!canRegisterLapCrossing(crossed, lapCooldownRef.current, maxProgressRef.current)) {
      return;
    }

    lapCooldownRef.current = true;
    maxProgressRef.current = ratio;

    const finished = registerLapComplete();
    prevPosRef.current = null;

    if (finished) {
      onFinished();
    }
  });

  return null;
};

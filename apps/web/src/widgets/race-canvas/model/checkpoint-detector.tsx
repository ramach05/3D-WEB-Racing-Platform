import { type RefObject, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RapierRigidBody } from '@react-three/rapier';
import type { TTrackConfig } from '@/entities/track';
import { accumulateLapTravel, advanceLapProgress, getTrackProgress } from '@/entities/track';
import {
  canRegisterLapCrossing,
  getRaceHudSnapshot,
  passedFinishLine,
  registerLapComplete,
  START_FINISH_COOLDOWN_RATIO,
} from '@/features/race-session';

type TCheckpointDetectorProps = {
  /** Конфиг трассы (centerline, финиш) */
  config: TTrackConfig;
  /** Ref физического тела машины */
  bodyRef: RefObject<RapierRigidBody | null>;
  /** Счётчик рестарта — сбрасывает прогресс круга */
  resetNonce: number;
  /** Колбэк при завершении гонки */
  onFinished: () => void;
};

/** Детектор кругов: финишная линия + прогресс по centerline. */
export const CheckpointDetector = ({
  config,
  bodyRef,
  resetNonce,
  onFinished,
}: TCheckpointDetectorProps) => {
  const prevPosRef = useRef<{ x: number; z: number } | null>(null);
  const maxProgressRef = useRef(0);
  const lapTravelRef = useRef(0);
  const lastRatioRef = useRef<number | null>(null);
  const lapCooldownRef = useRef(true);
  const resetNonceRef = useRef(resetNonce);

  // Отслеживает пересечение финиша и прогресс по centerline.
  useFrame(() => {
    if (resetNonceRef.current !== resetNonce) {
      resetNonceRef.current = resetNonce;
      prevPosRef.current = null;
      maxProgressRef.current = 0;
      lapTravelRef.current = 0;
      lastRatioRef.current = null;
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
    const travel = accumulateLapTravel(lapTravelRef.current, lastRatioRef.current, ratio);
    lapTravelRef.current = travel.lapTravel;
    lastRatioRef.current = travel.lastRatio;
    // Любой из двух счётчиков: maxProgress может залипнуть, travel — нет (и наоборот).
    const progress = Math.max(maxProgressRef.current, lapTravelRef.current);

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

    if (!canRegisterLapCrossing(crossed, lapCooldownRef.current, progress)) {
      return;
    }

    lapCooldownRef.current = true;
    maxProgressRef.current = 0;
    lapTravelRef.current = 0;
    lastRatioRef.current = ratio;

    const finished = registerLapComplete();
    prevPosRef.current = null;

    if (finished) {
      onFinished();
    }
  });

  return null;
};

import { type RefObject, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RapierRigidBody } from '@react-three/rapier';
import type { CheckpointLocalCoords, OrientedBox, TrackConfig } from '@/entities/track';
import { advanceLapProgress, getTrackProgress, isInsideCheckpoint } from '@/entities/track';
import { getRaceHudSnapshot, registerLapComplete } from '@/features/race-session';

type CheckpointDetectorProps = {
  config: TrackConfig;
  bodyRef: RefObject<RapierRigidBody | null>;
  resetNonce: number;
  onFinished: () => void;
};

type Vec2 = {
  x: number;
  z: number;
};

/** Минимальная доля круга до засчёта финишной линии (анти-ложный старт). */
export const MIN_LAP_PROGRESS = 0.55;

/** Зона у старт/финиш — игнорируем повторные срабатывания сразу после зачёта круга. */
export const START_FINISH_COOLDOWN_RATIO = 0.14;

/** Локальные координаты линии: lx — поперёк, lz — вдоль трассы. */
export const getTrackLineLocalCoords = (
  x: number,
  z: number,
  line: OrientedBox,
): CheckpointLocalCoords => {
  const dx = x - line.position[0];
  const dz = z - line.position[2];
  const sin = Math.sin(line.rotationY);
  const cos = Math.cos(line.rotationY);
  return {
    lx: dx * cos - dz * sin,
    lz: dx * sin + dz * cos,
  };
};

/** Проезд через зону чекпоинта с учётом перемещения между кадрами. */
export const passedCheckpointZone = (
  prevX: number | null,
  prevZ: number | null,
  x: number,
  z: number,
  checkpoint: OrientedBox,
): boolean => {
  if (isInsideCheckpoint(x, z, checkpoint)) {
    return true;
  }
  if (prevX === null || prevZ === null) {
    return false;
  }
  if (isInsideCheckpoint(prevX, prevZ, checkpoint)) {
    return true;
  }
  const steps = 12;
  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const sampleX = prevX + (x - prevX) * t;
    const sampleZ = prevZ + (z - prevZ) * t;
    if (isInsideCheckpoint(sampleX, sampleZ, checkpoint)) {
      return true;
    }
  }
  return false;
};

const segmentsIntersect = (a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean => {
  const denom = (b.x - a.x) * (d.z - c.z) - (b.z - a.z) * (d.x - c.x);
  if (Math.abs(denom) < 1e-9) {
    return false;
  }
  const t = ((c.x - a.x) * (d.z - c.z) - (c.z - a.z) * (d.x - c.x)) / denom;
  const u = ((c.x - a.x) * (b.z - a.z) - (c.z - a.z) * (b.x - a.x)) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
};

/** Пересечение траектории машины с отрезком линии финиша. */
export const crossedFinishLine = (
  prevX: number,
  prevZ: number,
  x: number,
  z: number,
  line: OrientedBox,
): boolean => {
  const halfWidth = line.size[0] / 2;
  const acrossX = Math.cos(line.rotationY);
  const acrossZ = -Math.sin(line.rotationY);
  const cx = line.position[0];
  const cz = line.position[2];

  const lineStart = {
    x: cx - acrossX * halfWidth,
    z: cz - acrossZ * halfWidth,
  };
  const lineEnd = {
    x: cx + acrossX * halfWidth,
    z: cz + acrossZ * halfWidth,
  };

  return segmentsIntersect({ x: prevX, z: prevZ }, { x, z }, lineStart, lineEnd);
};

/** Пересечение линии финиша с учётом перемещения между кадрами. */
export const passedFinishLine = (
  prevX: number | null,
  prevZ: number | null,
  x: number,
  z: number,
  line: OrientedBox,
): boolean => {
  if (prevX === null || prevZ === null) {
    return false;
  }
  if (crossedFinishLine(prevX, prevZ, x, z, line)) {
    return true;
  }
  const steps = 12;
  let segmentStartX = prevX;
  let segmentStartZ = prevZ;
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const sampleX = prevX + (x - prevX) * t;
    const sampleZ = prevZ + (z - prevZ) * t;
    if (crossedFinishLine(segmentStartX, segmentStartZ, sampleX, sampleZ, line)) {
      return true;
    }
    segmentStartX = sampleX;
    segmentStartZ = sampleZ;
  }
  return false;
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

    if (!crossed || lapCooldownRef.current || maxProgressRef.current < MIN_LAP_PROGRESS) {
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

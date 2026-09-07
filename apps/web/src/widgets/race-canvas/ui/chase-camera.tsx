import type { RefObject } from 'react';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, type Object3D, Quaternion, Vector3 } from 'three';
import type { TVec3 } from '@/entities/track';
import { getRaceHudSnapshot } from '@/features/race-session';

type TChaseCameraProps = {
  target: RefObject<Object3D | null>;
  spawnPosition: TVec3;
  spawnRotationY: number;
  resetNonce: number;
};

const chaseDesired = new Vector3();
const look = new Vector3();
const lookSmooth = new Vector3();
const worldPos = new Vector3();
const offset = new Vector3();
const quat = new Quaternion();
const introPos = new Vector3();
const finishOffset = new Vector3(0, 11, -22);

const INTRO_DURATION = 3.2;
const CHASE_Y = 5.5;
const CHASE_Z = -12;

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/** Камера: cinematic intro → chase → finish pull-back */
export const ChaseCamera = ({
  target,
  spawnPosition,
  spawnRotationY,
  resetNonce,
}: TChaseCameraProps) => {
  const lastNonce = useRef(resetNonce);
  const introElapsed = useRef(0);
  const reduced = useRef(prefersReducedMotion());
  const lookInitialized = useRef(false);

  useFrame((state, dt) => {
    if (lastNonce.current !== resetNonce) {
      lastNonce.current = resetNonce;
      introElapsed.current = 0;
      reduced.current = prefersReducedMotion();
      lookInitialized.current = false;
    }

    const visual = target.current;
    if (!visual) {
      return;
    }

    visual.updateWorldMatrix(true, false);
    visual.getWorldPosition(worldPos);
    visual.getWorldQuaternion(quat);
    look.set(worldPos.x, worldPos.y + 1.1, worldPos.z);

    const hud = getRaceHudSnapshot();
    const alpha = 1 - Math.pow(0.001, dt);

    if (hud.status === 'finished') {
      offset.copy(finishOffset).applyQuaternion(quat);
      chaseDesired.copy(worldPos).add(offset);
      const finishAlpha = 1 - Math.pow(0.08, dt);
      state.camera.position.lerp(chaseDesired, finishAlpha);
      look.y += 0.8;
      if (!lookInitialized.current) {
        lookSmooth.copy(look);
        lookInitialized.current = true;
      } else {
        lookSmooth.lerp(look, finishAlpha);
      }
      state.camera.lookAt(lookSmooth);
      return;
    }

    offset.set(0, CHASE_Y, CHASE_Z).applyQuaternion(quat);
    chaseDesired.copy(worldPos).add(offset);

    if (hud.status === 'racing' || reduced.current) {
      state.camera.position.lerp(chaseDesired, alpha);
      if (!lookInitialized.current) {
        lookSmooth.copy(look);
        lookInitialized.current = true;
      } else {
        lookSmooth.lerp(look, alpha);
      }
      state.camera.lookAt(lookSmooth);
      return;
    }

    // ready / countdown: orbit intro blending into chase seat
    introElapsed.current += dt;
    const t = Math.min(1, introElapsed.current / INTRO_DURATION);
    const ease = t * t * (3 - 2 * t);

    const angle = spawnRotationY + Math.PI + introElapsed.current * 0.55;
    const radius = MathUtils.lerp(26, 14, ease);
    const height = MathUtils.lerp(16, CHASE_Y + 2, ease);
    introPos.set(
      spawnPosition[0] + Math.sin(angle) * radius,
      spawnPosition[1] + height,
      spawnPosition[2] + Math.cos(angle) * radius,
    );

    state.camera.position.lerpVectors(introPos, chaseDesired, ease * ease);
    const lookY = MathUtils.lerp(spawnPosition[1] + 2.2, look.y, ease);
    look.set(
      MathUtils.lerp(spawnPosition[0], worldPos.x, ease),
      lookY,
      MathUtils.lerp(spawnPosition[2], worldPos.z, ease),
    );
    if (!lookInitialized.current) {
      lookSmooth.copy(look);
      lookInitialized.current = true;
    } else {
      lookSmooth.lerp(look, alpha);
    }
    state.camera.lookAt(lookSmooth);
  });

  return null;
};

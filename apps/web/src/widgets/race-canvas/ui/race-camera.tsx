import type { RefObject } from 'react';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  MathUtils,
  type Object3D,
  type PerspectiveCamera,
  Quaternion,
  Vector3,
} from 'three';
import { getDriveSfxSample } from '@/features/race-audio';
import type { TVec3 } from '@/entities/track';
import { getRaceHudSnapshot } from '@/features/race-session';
import { mapModeSpeedToFov, CAMERA_FOV_BASE } from '@/widgets/race-canvas/lib/camera-fov';
import {
  getCameraMode,
  type TCameraMode,
} from '@/widgets/race-canvas/lib/camera-mode';
import {
  CAMERA_SHAKE_LOOK_AMP,
  CAMERA_SHAKE_POS_AMP,
  mapContinuousShake,
  resetCameraShake,
  tickCameraShake,
} from '@/widgets/race-canvas/lib/camera-shake';

type TRaceCameraProps = {
  /** Визуальная группа машины */
  target: RefObject<Object3D | null>;
  /** Позиция спавна для intro-орбиты */
  spawnPosition: TVec3;
  /** Угол спавна (рад) */
  spawnRotationY: number;
  /** Счётчик рестарта — сбрасывает intro и режим */
  resetNonce: number;
};

type TCameraSeat = {
  /** Локальный offset камеры */
  offset: Vector3;
  /** Локальный look-target относительно машины (до world) */
  lookLocal: Vector3;
  /** Стиль следования */
  pursuit: 'lerp' | 'snap' | 'operator';
  /** Скорость сходимости для lerp (меньше = жёстче) */
  followPow: number;
  /** Множитель shake (близкие камеры — слабее, иначе виден салон) */
  shakeScale: number;
};

const chaseDesired = new Vector3();
const look = new Vector3();
const lookSmooth = new Vector3();
const worldPos = new Vector3();
const offset = new Vector3();
const lookLocal = new Vector3();
const quat = new Quaternion();
const introPos = new Vector3();
const shakePos = new Vector3();
const shakeLook = new Vector3();
const carVel = new Vector3();
const finishOffset = new Vector3(0, 11, -22);

const INTRO_DURATION = 3.2;
const CHASE_Y = 4.2;
const CHASE_Z = -8;

/** TV: полувремя позиции — плавно, но успевает за разгоном */
const TV_POS_HALFLIFE = 0.12;
/** TV: look чуть мягче — «рука оператора» */
const TV_LOOK_HALFLIFE = 0.18;
/** TV: упреждение по скорости машины (с) */
const TV_LEAD_SEC = 0.28;
/** Потолок оценки скорости для lead (м/с) */
const TV_VEL_CAP = 36;

/** Seats в локале машины (Z назад отрицательный у chase) */
const SEATS: Record<TCameraMode, TCameraSeat> = {
  chase: {
    offset: new Vector3(0, CHASE_Y, CHASE_Z),
    lookLocal: new Vector3(0, 1.1, 0),
    pursuit: 'lerp',
    followPow: 0.001,
    shakeScale: 1,
  },
  bumper: {
    offset: new Vector3(0, 0.95, 2.6),
    lookLocal: new Vector3(0, 0.9, 14),
    pursuit: 'snap',
    followPow: 0.001,
    shakeScale: 0.25,
  },
  tv: {
    offset: new Vector3(7.5, 3.8, -4),
    lookLocal: new Vector3(0, 1.2, 0),
    pursuit: 'operator',
    followPow: 0.001,
    shakeScale: 1,
  },
};

/** Alpha экспоненциального сглаживания по half-life */
const halfLifeAlpha = (dt: number, halfLife: number): number =>
  1 - Math.pow(0.5, dt / Math.max(1e-4, halfLife));


/** Проверяет prefers-reduced-motion в браузере */
const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/** Применяет FOV к PerspectiveCamera */
const applyFov = (camera: PerspectiveCamera, fov: number): void => {
  if (Math.abs(camera.fov - fov) < 0.05) {
    return;
  }
  camera.fov = fov;
  camera.updateProjectionMatrix();
};

/** Псевдослучайный shake-вектор в мире (детерминирован от времени) */
const fillShakeOffset = (out: Vector3, strength: number, amp: number, t: number): void => {
  if (strength <= 0) {
    out.set(0, 0, 0);
    return;
  }
  const s = strength * amp;
  out.set(
    Math.sin(t * 47.1) * s,
    Math.sin(t * 53.7 + 1.7) * s * 0.65,
    Math.cos(t * 41.3 + 0.9) * s,
  );
};

/** Камера: cinematic intro → seat (chase/bumper/tv) → finish pull-back */
export const RaceCamera = ({
  target,
  spawnPosition,
  spawnRotationY,
  resetNonce,
}: TRaceCameraProps) => {
  const lastNonce = useRef(resetNonce);
  const introElapsed = useRef(0);
  const reduced = useRef(prefersReducedMotion());
  const lookInitialized = useRef(false);
  const elapsed = useRef(0);
  const lastMode = useRef<TCameraMode | null>(null);
  const prevCarPos = useRef(new Vector3());
  const carVelReady = useRef(false);

  // Intro → seat → finish; FOV и shake на racing.
  useFrame((state, dt) => {
    if (lastNonce.current !== resetNonce) {
      lastNonce.current = resetNonce;
      introElapsed.current = 0;
      elapsed.current = 0;
      reduced.current = prefersReducedMotion();
      lookInitialized.current = false;
      lastMode.current = null;
      carVelReady.current = false;
      resetCameraShake();
      applyFov(state.camera as PerspectiveCamera, CAMERA_FOV_BASE);
    }

    const visual = target.current;
    if (!visual) {
      return;
    }

    const clampedDt = Math.min(0.05, Math.max(0, dt));
    elapsed.current += clampedDt;

    visual.updateWorldMatrix(true, false);
    visual.getWorldPosition(worldPos);
    visual.getWorldQuaternion(quat);

    if (!carVelReady.current) {
      prevCarPos.current.copy(worldPos);
      carVel.set(0, 0, 0);
      carVelReady.current = true;
    } else if (clampedDt > 1e-5) {
      carVel.copy(worldPos).sub(prevCarPos.current).divideScalar(clampedDt);
      const speed = carVel.length();
      if (speed > TV_VEL_CAP) {
        carVel.multiplyScalar(TV_VEL_CAP / speed);
      }
      prevCarPos.current.copy(worldPos);
    }

    const hud = getRaceHudSnapshot();
    const cam = state.camera as PerspectiveCamera;

    if (hud.status === 'finished') {
      applyFov(cam, CAMERA_FOV_BASE);
      offset.copy(finishOffset).applyQuaternion(quat);
      chaseDesired.copy(worldPos).add(offset);
      const finishAlpha = 1 - Math.pow(0.08, clampedDt);
      state.camera.position.lerp(chaseDesired, finishAlpha);
      look.set(worldPos.x, worldPos.y + 1.9, worldPos.z);
      if (!lookInitialized.current) {
        lookSmooth.copy(look);
        lookInitialized.current = true;
      } else {
        lookSmooth.lerp(look, finishAlpha);
      }
      state.camera.lookAt(lookSmooth);
      return;
    }

    const mode = getCameraMode();
    const seat = SEATS[mode];
    const modeChanged = lastMode.current !== mode;
    lastMode.current = mode;

    offset.copy(seat.offset).applyQuaternion(quat);
    chaseDesired.copy(worldPos).add(offset);
    lookLocal.copy(seat.lookLocal).applyQuaternion(quat);
    look.copy(worldPos).add(lookLocal);

    const sfx = getDriveSfxSample();
    const fov = reduced.current ? CAMERA_FOV_BASE : mapModeSpeedToFov(mode, sfx.speedMs);
    applyFov(cam, fov);

    const continuous = reduced.current
      ? 0
      : mapContinuousShake(sfx.oilStrength, sfx.skidIntensity, sfx.wallScrape);
    const shakeRaw = reduced.current ? 0 : tickCameraShake(clampedDt, continuous);
    const shake = shakeRaw * seat.shakeScale;
    fillShakeOffset(shakePos, shake, CAMERA_SHAKE_POS_AMP, elapsed.current);
    fillShakeOffset(shakeLook, shake, CAMERA_SHAKE_LOOK_AMP, elapsed.current + 10);

    if (hud.status === 'racing' || hud.status === 'paused' || reduced.current) {
      if (seat.pursuit === 'operator') {
        chaseDesired.addScaledVector(carVel, TV_LEAD_SEC);
        look.addScaledVector(carVel, TV_LEAD_SEC);
      }
      chaseDesired.add(shakePos);
      look.add(shakeLook);

      if (seat.pursuit === 'snap' || modeChanged) {
        state.camera.position.copy(chaseDesired);
        lookSmooth.copy(look);
        lookInitialized.current = true;
      } else if (seat.pursuit === 'operator') {
        const posA = halfLifeAlpha(clampedDt, TV_POS_HALFLIFE);
        const lookA = halfLifeAlpha(clampedDt, TV_LOOK_HALFLIFE);
        state.camera.position.lerp(chaseDesired, posA);
        if (!lookInitialized.current) {
          lookSmooth.copy(look);
          lookInitialized.current = true;
        } else {
          lookSmooth.lerp(look, lookA);
        }
      } else {
        const alpha = 1 - Math.pow(seat.followPow, clampedDt);
        state.camera.position.lerp(chaseDesired, alpha);
        if (!lookInitialized.current) {
          lookSmooth.copy(look);
          lookInitialized.current = true;
        } else {
          lookSmooth.lerp(look, alpha);
        }
      }
      state.camera.lookAt(lookSmooth);
      return;
    }

    // ready / countdown: orbit intro blending into chase seat
    applyFov(cam, CAMERA_FOV_BASE);
    introElapsed.current += clampedDt;
    const t = Math.min(1, introElapsed.current / INTRO_DURATION);
    const ease = t * t * (3 - 2 * t);

    const angle = spawnRotationY + Math.PI + introElapsed.current * 0.55;
    const radius = MathUtils.lerp(26, 10, ease);
    const height = MathUtils.lerp(16, CHASE_Y + 2, ease);
    introPos.set(
      spawnPosition[0] + Math.sin(angle) * radius,
      spawnPosition[1] + height,
      spawnPosition[2] + Math.cos(angle) * radius,
    );

    const chaseSeat = SEATS.chase;
    offset.copy(chaseSeat.offset).applyQuaternion(quat);
    chaseDesired.copy(worldPos).add(offset);
    const introAlpha = 1 - Math.pow(0.001, clampedDt);

    state.camera.position.lerpVectors(introPos, chaseDesired, ease * ease);
    const lookY = MathUtils.lerp(spawnPosition[1] + 2.2, worldPos.y + 1.1, ease);
    look.set(
      MathUtils.lerp(spawnPosition[0], worldPos.x, ease),
      lookY,
      MathUtils.lerp(spawnPosition[2], worldPos.z, ease),
    );
    if (!lookInitialized.current) {
      lookSmooth.copy(look);
      lookInitialized.current = true;
    } else {
      lookSmooth.lerp(look, introAlpha);
    }
    state.camera.lookAt(lookSmooth);
  });

  return null;
};

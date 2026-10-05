import { type RefObject, useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useRapier } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { Quaternion, Vector3 } from 'three';
import type { Group, Object3D, SpotLight } from 'three';
import type { TCarSkin, TLoopPoint, TOrientedBox, TVec3 } from '@/entities/track';
import type { TVehicleId } from '@/entities/vehicle';
import {
  IDLE_DRIVE_SFX_SAMPLE,
  mapOilSlapFromSpeed,
  mapWallScrape,
  pulseDriveOilSlap,
  resetDriveSfx,
  tickDriveSfxSample,
} from '@/features/race-audio';
import { pulseCameraShake } from '@/widgets/race-canvas/lib/camera-shake';
import {
  beginCountdown,
  computeSteerStrength,
  dampLateralVelocity,
  getDriveInput,
  getRaceHudSnapshot,
  integrateDriveForward,
  integrateSteerYaw,
  passedCheckpointZone,
  setVehiclePose,
  tickRace,
  VEHICLE_MAX_SPEED,
  VEHICLE_REVERSE_MAX,
} from '@/features/race-session';
import { vehiclePalette } from '@/shared/config';
import { VEHICLE_GROUPS, WALL_PROBE_GROUPS } from '@/widgets/race-canvas/lib/collision-groups';
import {
  applyOilThrottleFactor,
  computeOilSkidIntensity,
  computeOilYawKick,
  resetOilGrip,
  resolveOilSurfaceGrip,
  tickOilGrip,
} from '@/widgets/race-canvas/lib/oil-grip';
import { ROAD_TOP_Y } from '@/widgets/race-canvas/lib/road-ribbon-geometry';
import {
  computeSkidIntensity,
  SKID_SMOKE_THRESHOLD,
} from '@/widgets/race-canvas/lib/skid-intensity';
import { pushSkidSample, pushSkidSmoke } from '@/widgets/race-canvas/lib/skid-marks-store';
import {
  resetTireHitDamping,
  tickTireHitDamping,
} from '@/widgets/race-canvas/lib/tire-hit-damping';
import {
  aggregateWheelSurfaces,
  applyOffroadThrottleFactor,
  combineSurfaceGrip,
  computeKerbRumble,
  computeOffroadFxStrength,
  sampleAsphaltMicroGrip,
  sampleTrackSurfaceKind,
  type TTrackSurfaceKind,
} from '@/widgets/race-canvas/lib/track-surface';
import {
  headlightLocalPositions,
  type THeadlightLamps,
} from '@/widgets/race-canvas/vehicle/vehicle-body-variants';
import {
  VehicleModel,
  type TVehicleDriveVisual,
} from '@/widgets/race-canvas/vehicle/vehicle-model';

type TSkidWheelPos = { x: number; z: number };

/** Физические канделы — левая и правая фары (с запасом под decay=2) */
const HEADLIGHT_INTENSITY = 75;
const HEADLIGHT_ANGLE = 0.42;
const HEADLIGHT_PENUMBRA = 0.7;
const HEADLIGHT_DISTANCE = 24;
const HEADLIGHT_DECAY = 2;
/** Прицел: в плоскость асфальта впереди */
const HEADLIGHT_TARGET: TVec3 = [0, -1.0, 11];
/** Одна shadowed-фара × 768² вместо двух — главный shadow hotspot ночи */
const HEADLIGHT_SHADOW_MAP = 768;
const HEADLIGHT_SHADOW_NEAR = 0.5;
const HEADLIGHT_SHADOW_BIAS = -0.00002;
const HEADLIGHT_SHADOW_NORMAL_BIAS = 0.015;
/** fov shadow camera ≈ 2 × spot angle (градусы) — без пустого frustum */
const HEADLIGHT_SHADOW_FOV = (2 * HEADLIGHT_ANGLE * 180) / Math.PI;

type TVehicleProps = {
  /** Позиция спавна на трассе */
  spawnPosition: TVec3;
  /** Угол поворота при спавне (рад) */
  spawnRotationY: number;
  /** Счётчик рестарта гонки */
  resetNonce: number;
  /** Ref физического тела Rapier */
  bodyRef: RefObject<RapierRigidBody | null>;
  /** Ref визуальной группы кузова */
  visualRef: RefObject<Group | null>;
  /** Выбранный кузов из гаража */
  vehicleId: TVehicleId;
  /** Раскраска кузова / кабины / колёс */
  carSkin: TCarSkin;
  /** Включить фары (ночь) */
  headlightsOn: boolean;
  /** Зоны луж масла на трассе */
  oilSlicks: TOrientedBox[];
  /** Центровая линия трассы */
  centerline: TLoopPoint[];
  /** Ширина дороги */
  roadWidth: number;
};

type TVehicleHeadlightsProps = {
  /** Ref физического тела для синхронизации фар */
  bodyRef: RefObject<RapierRigidBody | null>;
  /** Кузов — fallback, пока GLB не отдал измеренные лампы */
  vehicleId: TVehicleId;
  /** Позиции из VehicleModel (меши Headlight после fit) */
  headlightLampsRef: RefObject<THeadlightLamps | null>;
};

/** Настраивает shadow map только у левой фары */
const configureHeadlightShadow = (light: SpotLight) => {
  light.castShadow = true;
  light.shadow.mapSize.set(HEADLIGHT_SHADOW_MAP, HEADLIGHT_SHADOW_MAP);
  light.shadow.bias = HEADLIGHT_SHADOW_BIAS;
  light.shadow.normalBias = HEADLIGHT_SHADOW_NORMAL_BIAS;
  light.shadow.camera.near = HEADLIGHT_SHADOW_NEAR;
  light.shadow.camera.far = HEADLIGHT_DISTANCE;
  light.shadow.camera.fov = HEADLIGHT_SHADOW_FOV;
  light.shadow.camera.updateProjectionMatrix();
};

/** Фары вне RigidBody — иначе shadow map SpotLight не окклюдирует стены */
const VehicleHeadlights = ({ bodyRef, vehicleId, headlightLampsRef }: TVehicleHeadlightsProps) => {
  const groupRef = useRef<Group>(null);
  const headlightTargetRef = useRef<Object3D>(null);
  const leftHeadlightRef = useRef<SpotLight>(null);
  const rightHeadlightRef = useRef<SpotLight>(null);
  const fallbackLamps = headlightLocalPositions(vehicleId);

  /** Привязывает aim-target; тень только у левой фары */
  const bindTargets = () => {
    const aim = headlightTargetRef.current;
    const left = leftHeadlightRef.current;
    const right = rightHeadlightRef.current;
    if (!aim) {
      return;
    }
    aim.updateMatrixWorld();
    if (left) {
      if (left.target !== aim) {
        left.target = aim;
      }
      configureHeadlightShadow(left);
    }
    if (right && right.target !== aim) {
      right.target = aim;
    }
  };

  // Привязывает aim-target к фарам после монтирования.
  useLayoutEffect(() => {
    bindTargets();
  }, []);

  // Синхронизирует группу фар с позой RigidBody каждый кадр.
  useFrame(() => {
    const body = bodyRef.current;
    const group = groupRef.current;
    if (!body || !group) {
      return;
    }
    const { x, y, z } = body.translation();
    const rotation = body.rotation();
    group.position.set(x, y, z);
    group.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    const lamps = headlightLampsRef.current ?? fallbackLamps;
    const left = leftHeadlightRef.current;
    const right = rightHeadlightRef.current;
    if (left) {
      left.position.set(lamps.left[0], lamps.left[1], lamps.left[2]);
    }
    if (right) {
      right.position.set(lamps.right[0], lamps.right[1], lamps.right[2]);
    }
    const aim = headlightTargetRef.current;
    if (!aim) {
      return;
    }
    aim.updateMatrixWorld();
    if (left && left.target !== aim) {
      left.target = aim;
    }
    if (right && right.target !== aim) {
      right.target = aim;
    }
  });

  return (
    <group ref={groupRef}>
      <object3D ref={headlightTargetRef} position={HEADLIGHT_TARGET} />
      <spotLight
        ref={leftHeadlightRef}
        position={fallbackLamps.left}
        angle={HEADLIGHT_ANGLE}
        penumbra={HEADLIGHT_PENUMBRA}
        intensity={HEADLIGHT_INTENSITY}
        distance={HEADLIGHT_DISTANCE}
        decay={HEADLIGHT_DECAY}
        color={vehiclePalette.headlight}
        castShadow
        shadow-mapSize-width={HEADLIGHT_SHADOW_MAP}
        shadow-mapSize-height={HEADLIGHT_SHADOW_MAP}
        shadow-bias={HEADLIGHT_SHADOW_BIAS}
        shadow-normalBias={HEADLIGHT_SHADOW_NORMAL_BIAS}
        shadow-camera-near={HEADLIGHT_SHADOW_NEAR}
        shadow-camera-far={HEADLIGHT_DISTANCE}
        shadow-camera-fov={HEADLIGHT_SHADOW_FOV}
      />
      <spotLight
        ref={rightHeadlightRef}
        position={fallbackLamps.right}
        angle={HEADLIGHT_ANGLE}
        penumbra={HEADLIGHT_PENUMBRA}
        intensity={HEADLIGHT_INTENSITY}
        distance={HEADLIGHT_DISTANCE}
        decay={HEADLIGHT_DECAY}
        color={vehiclePalette.headlight}
        castShadow={false}
      />
    </group>
  );
};

const WHEEL_LOCAL: TVec3[] = [
  [-0.72, 0.05, 1.05],
  [0.72, 0.05, 1.05],
  [-0.72, 0.05, -1.05],
  [0.72, 0.05, -1.05],
];

const MAX_SPEED = VEHICLE_MAX_SPEED;
const REVERSE_MAX = VEHICLE_REVERSE_MAX;
/** Горизонтальная капсула ≈ габариты кузова: гладкое скольжение вдоль стен */
const COLLIDER_HALF_X = 0.82;
const COLLIDER_HALF_Z = 1.65;
const COLLIDER_RADIUS = COLLIDER_HALF_X;
const COLLIDER_HALF_HEIGHT = COLLIDER_HALF_Z - COLLIDER_RADIUS;
const COLLIDER_Y = COLLIDER_RADIUS;
/** Запас луча за край коллайдера для раннего slide */
const WALL_PROBE_MARGIN = 0.2;
/** Look-ahead (с): удлиняет probe на скорость «в стену», ~2–3 кадра @ 60 fps */
const WALL_PROBE_LOOKAHEAD = 0.04;
/** Высота спавна над точкой старта — машина падает на трассу */
const SPAWN_DROP_HEIGHT = 3.2;
/** После касания ждём почти нулевую вертикальную скорость */
const LAND_SETTLE_VY = 1.2;

/** Поднимает точку спавна на SPAWN_DROP_HEIGHT над асфальтом */
const elevatedSpawn = (spawnPosition: TVec3): { x: number; y: number; z: number } => ({
  x: spawnPosition[0],
  y: spawnPosition[1] + SPAWN_DROP_HEIGHT,
  z: spawnPosition[2],
});

const tmpForward = new Vector3();
const tmpRight = new Vector3();
const tmpVel = new Vector3();
const tmpQuat = new Quaternion();
const tmpOrigin = new Vector3();
const tmpDesired = new Vector3();
const tmpNormal = new Vector3();
const tmpSlide = new Vector3();

/** Скользит вдоль стены: убирает составляющую скорости по нормали стены */
const slideAlongWalls = (
  world: ReturnType<typeof useRapier>['world'],
  rapier: ReturnType<typeof useRapier>['rapier'],
  body: RapierRigidBody,
  velocity: Vector3,
): Vector3 => {
  const translation = body.translation();
  const rotation = body.rotation();
  tmpQuat.set(rotation.x, rotation.y, rotation.z, rotation.w);
  tmpForward.set(0, 0, 1).applyQuaternion(tmpQuat);
  tmpRight.set(1, 0, 0).applyQuaternion(tmpQuat);

  const probes = [tmpForward, tmpForward.clone().negate(), tmpRight, tmpRight.clone().negate()];

  const result = velocity.clone();

  for (const dir of probes) {
    // dir — луч к стене; удлиняем probe при движении навстречу
    const intoProbe = Math.max(0, velocity.dot(dir));
    if (intoProbe < 0.01) {
      continue;
    }
    const probeLen =
      Math.abs(dir.dot(tmpForward)) * COLLIDER_HALF_Z +
      Math.abs(dir.dot(tmpRight)) * COLLIDER_HALF_X +
      WALL_PROBE_MARGIN +
      intoProbe * WALL_PROBE_LOOKAHEAD;
    const ray = new rapier.Ray(
      { x: translation.x, y: translation.y + COLLIDER_Y, z: translation.z },
      { x: dir.x, y: 0, z: dir.z },
    );
    const hit = world.castRayAndGetNormal(
      ray,
      probeLen,
      true,
      undefined,
      WALL_PROBE_GROUPS,
      undefined,
      body,
    );
    if (!hit) {
      continue;
    }
    // Нормаль стены (не ось машины) — иначе под углом обнуляется весь forward
    tmpNormal.set(hit.normal.x, 0, hit.normal.z);
    if (tmpNormal.lengthSq() < 0.001) {
      continue;
    }
    tmpNormal.normalize();
    // Нормаль должна смотреть навстречу лучу (из стены к машине)
    if (tmpNormal.dot(dir) > 0) {
      tmpNormal.negate();
    }
    const intoWall = result.dot(tmpNormal);
    if (intoWall < 0) {
      tmpSlide.copy(tmpNormal).multiplyScalar(intoWall);
      result.sub(tmpSlide);
    }
  }

  return result;
};

/** Проезд колеса через любую oriented-box зону с subsample между кадрами. */
const isWheelOnAnyZone = (
  prevX: number | null,
  prevZ: number | null,
  x: number,
  z: number,
  zones: TOrientedBox[],
): boolean => {
  for (const zone of zones) {
    if (passedCheckpointZone(prevX, prevZ, x, z, zone)) {
      return true;
    }
  }
  return false;
};

/** Arcade-машина: отзывчивое руление, скольжение вдоль стен */
export const Vehicle = ({
  spawnPosition,
  spawnRotationY,
  resetNonce,
  bodyRef,
  visualRef,
  vehicleId,
  carSkin,
  headlightsOn,
  oilSlicks,
  centerline,
  roadWidth,
}: TVehicleProps) => {
  const { world, rapier } = useRapier();
  const lastNonce = useRef(resetNonce);
  const awaitingLand = useRef(true);
  const lastSkidPos = useRef<(TSkidWheelPos | null)[]>([null, null, null, null]);
  const smokeTimer = useRef(0);
  const dirtSmokeTimer = useRef(0);
  const prevZoneWheelPos = useRef<(TSkidWheelPos | null)[]>([null, null, null, null]);
  const prevWheelsOnOil = useRef(0);
  const kerbPhase = useRef(0);
  const kerbShakeCooldown = useRef(0);
  const driveVisualRef = useRef<TVehicleDriveVisual>({
    forwardSpeed: 0,
    steer: 0,
    brake: 0,
    kerbRumble: 0,
  });
  const headlightLampsRef = useRef<THeadlightLamps | null>(null);

  const clearSkidTrail = () => {
    lastSkidPos.current = [null, null, null, null];
    smokeTimer.current = 0;
    dirtSmokeTimer.current = 0;
  };

  // Arcade-физика: рестарт, ввод, grip и скольжение вдоль стен.
  useFrame((_, dt) => {
    const body = bodyRef.current;
    if (!body) {
      return;
    }

    if (lastNonce.current !== resetNonce) {
      lastNonce.current = resetNonce;
      awaitingLand.current = true;
      resetTireHitDamping();
      resetOilGrip();
      resetDriveSfx();
      prevZoneWheelPos.current = [null, null, null, null];
      prevWheelsOnOil.current = 0;
      kerbPhase.current = 0;
      kerbShakeCooldown.current = 0;
      driveVisualRef.current.kerbRumble = 0;
      clearSkidTrail();
      const visual = visualRef.current;
      if (visual) {
        visual.position.y = 0;
        visual.rotation.x = 0;
      }
      body.setTranslation(elevatedSpawn(spawnPosition), true);
      body.setRotation(
        { x: 0, y: Math.sin(spawnRotationY / 2), z: 0, w: Math.cos(spawnRotationY / 2) },
        true,
      );
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    const rotation = body.rotation();
    tmpQuat.set(rotation.x, rotation.y, rotation.z, rotation.w);
    tmpForward.set(0, 0, 1).applyQuaternion(tmpQuat);
    tmpRight.set(1, 0, 0).applyQuaternion(tmpQuat);

    const linvel = body.linvel();
    tmpVel.set(linvel.x, linvel.y, linvel.z);
    const speed = Math.hypot(linvel.x, linvel.z);
    tickRace(speed * 3.6);

    const translation = body.translation();
    setVehiclePose(translation.x, translation.z, Math.atan2(tmpForward.x, tmpForward.z));
    let wheelGrounded = false;
    for (const offset of WHEEL_LOCAL) {
      tmpOrigin.set(offset[0], offset[1], offset[2]).applyQuaternion(tmpQuat);
      tmpOrigin.x += translation.x;
      tmpOrigin.y += translation.y;
      tmpOrigin.z += translation.z;
      const ray = new rapier.Ray(
        { x: tmpOrigin.x, y: tmpOrigin.y, z: tmpOrigin.z },
        { x: 0, y: -1, z: 0 },
      );
      const hit = world.castRay(ray, 0.65, true, undefined, undefined, undefined, body);
      if (hit) {
        wheelGrounded = true;
        break;
      }
    }
    const grounded = wheelGrounded || translation.y < 2.5;

    const hud = getRaceHudSnapshot();
    const input = getDriveInput();
    const forwardSpeed = tmpVel.dot(tmpForward);
    driveVisualRef.current.forwardSpeed = hud.status === 'racing' ? forwardSpeed : 0;
    driveVisualRef.current.steer = input.steer;
    driveVisualRef.current.brake = input.brake;

    if (awaitingLand.current && hud.status === 'ready') {
      if (wheelGrounded && Math.abs(linvel.y) < LAND_SETTLE_VY) {
        awaitingLand.current = false;
        beginCountdown();
      }
      tickDriveSfxSample(IDLE_DRIVE_SFX_SAMPLE);
      return;
    }

    if (hud.status !== 'racing') {
      clearSkidTrail();
      driveVisualRef.current.kerbRumble = 0;
      tickDriveSfxSample(IDLE_DRIVE_SFX_SAMPLE);
      return;
    }

    const clampedDt = Math.min(dt, 1 / 30);
    if (!grounded) {
      clearSkidTrail();
      driveVisualRef.current.kerbRumble = 0;
      tickDriveSfxSample({
        ...IDLE_DRIVE_SFX_SAMPLE,
        active: true,
        speedMs: speed,
        throttle: input.throttle,
        brake: input.brake,
        handbrake: input.handbrake,
        grounded: false,
      });
      return;
    }

    // Детект поверхностей / масла по каждому колесу.
    const wheelOnOil: boolean[] = [false, false, false, false];
    const wheelKinds: TTrackSurfaceKind[] = ['asphalt', 'asphalt', 'asphalt', 'asphalt'];
    let wheelsOnOil = 0;
    let microSum = 0;
    for (let i = 0; i < WHEEL_LOCAL.length; i += 1) {
      const offset = WHEEL_LOCAL[i]!;
      tmpOrigin.set(offset[0], offset[1], offset[2]).applyQuaternion(tmpQuat);
      const wx = tmpOrigin.x + translation.x;
      const wz = tmpOrigin.z + translation.z;
      const prevWheel = prevZoneWheelPos.current[i];
      const onOil = isWheelOnAnyZone(prevWheel?.x ?? null, prevWheel?.z ?? null, wx, wz, oilSlicks);
      wheelOnOil[i] = onOil;
      if (onOil) {
        wheelsOnOil += 1;
      }
      wheelKinds[i] = sampleTrackSurfaceKind(wx, wz, centerline, roadWidth);
      microSum += sampleAsphaltMicroGrip(wx, wz);
      prevZoneWheelPos.current[i] = { x: wx, z: wz };
    }
    const surfaces = aggregateWheelSurfaces(wheelKinds);
    const asphaltMicro = microSum / WHEEL_LOCAL.length;
    const oilStrength = tickOilGrip(wheelsOnOil / WHEEL_LOCAL.length, clampedDt);
    const oilSurfaceGrip = resolveOilSurfaceGrip(oilStrength);
    const surfaceGrip = combineSurfaceGrip(
      oilSurfaceGrip,
      surfaces.offroad,
      surfaces.kerb,
      asphaltMicro,
    );
    const offroadFx = computeOffroadFxStrength(surfaces.offroad, forwardSpeed);
    const kerbRumble = computeKerbRumble(surfaces.kerb, forwardSpeed);
    driveVisualRef.current.kerbRumble = kerbRumble;

    if (prevWheelsOnOil.current === 0 && wheelsOnOil > 0) {
      const slap = mapOilSlapFromSpeed(speed);
      pulseDriveOilSlap(slap);
      pulseCameraShake(slap);
    }
    prevWheelsOnOil.current = wheelsOnOil;

    if (kerbRumble > 0) {
      kerbPhase.current += clampedDt * (6 + speed * 0.35);
      kerbShakeCooldown.current = Math.max(0, kerbShakeCooldown.current - clampedDt);
      if (kerbShakeCooldown.current <= 0) {
        pulseCameraShake(0.08 + kerbRumble * 0.22);
        kerbShakeCooldown.current = 0.09 - kerbRumble * 0.035;
      }
      const visual = visualRef.current;
      if (visual) {
        const amp = 0.018 + kerbRumble * 0.022;
        visual.position.y = Math.sin(kerbPhase.current * 18) * amp;
        visual.rotation.x = Math.sin(kerbPhase.current * 23) * amp * 0.55;
      }
    } else {
      kerbPhase.current = 0;
      kerbShakeCooldown.current = 0;
      const visual = visualRef.current;
      if (visual) {
        visual.position.y = 0;
        visual.rotation.x = 0;
      }
    }

    let targetForward = integrateDriveForward(forwardSpeed, {
      throttle: input.throttle,
      brake: input.brake,
      handbrake: input.handbrake,
      dt: clampedDt,
    });

    targetForward = applyOilThrottleFactor(
      forwardSpeed,
      targetForward,
      input.throttle,
      oilStrength,
    );
    targetForward = applyOffroadThrottleFactor(
      forwardSpeed,
      targetForward,
      input.throttle,
      surfaces.offroad,
    );
    targetForward = Math.max(-REVERSE_MAX, Math.min(MAX_SPEED, targetForward));
    targetForward *= tickTireHitDamping(clampedDt);

    const lateral = tmpVel.dot(tmpRight);
    const dampedLateral = dampLateralVelocity(
      lateral,
      input.handbrake,
      input.throttle,
      clampedDt,
      surfaceGrip,
    );

    const skid = computeSkidIntensity({
      brake: input.brake,
      throttle: input.throttle,
      handbrake: input.handbrake,
      forwardSpeed,
      lateral,
      grounded: wheelGrounded,
    });
    // Intensity следа масла для колеса, которое сейчас на луже (не residual).
    const oilSkidActive = wheelsOnOil > 0 ? computeOilSkidIntensity(1, forwardSpeed) : 0;
    const offroadSkidBoost = offroadFx * 0.35;

    let anySkid = false;
    if (!wheelGrounded) {
      clearSkidTrail();
    } else {
      for (let i = 0; i < WHEEL_LOCAL.length; i += 1) {
        const inNormalSkid = skid.intensity > 0 && (skid.wheels === 'all' || i >= 2);
        const inOilSkid = wheelOnOil[i] === true && oilSkidActive > 0;
        const inOffroadSkid = wheelKinds[i] === 'offroad' && offroadSkidBoost > 0;
        const wheelIntensity = Math.max(
          inNormalSkid ? skid.intensity : 0,
          inOilSkid ? oilSkidActive : 0,
          inOffroadSkid ? offroadSkidBoost : 0,
        );

        if (wheelIntensity <= 0) {
          lastSkidPos.current[i] = null;
          continue;
        }

        anySkid = true;
        const offset = WHEEL_LOCAL[i]!;
        tmpOrigin.set(offset[0], offset[1], offset[2]).applyQuaternion(tmpQuat);
        const wx = tmpOrigin.x + translation.x;
        const wz = tmpOrigin.z + translation.z;
        const prevWheel = lastSkidPos.current[i];
        if (prevWheel) {
          pushSkidSample(prevWheel.x, prevWheel.z, wx, wz, wheelIntensity);
        }
        lastSkidPos.current[i] = { x: wx, z: wz };
      }

      const smoking = skid.smoking || (oilSkidActive > SKID_SMOKE_THRESHOLD && wheelsOnOil > 0);
      if (!anySkid && offroadFx <= 0) {
        smokeTimer.current = 0;
        dirtSmokeTimer.current = 0;
      } else if (smoking) {
        smokeTimer.current += clampedDt;
        const peakIntensity = Math.max(skid.intensity, oilSkidActive);
        const smokeInterval = 0.09 - peakIntensity * 0.055;
        if (smokeTimer.current >= smokeInterval) {
          smokeTimer.current = 0;
          const wakeX = linvel.x + tmpRight.x * dampedLateral * 0.25;
          const wakeZ = linvel.z + tmpRight.z * dampedLateral * 0.25;
          for (let i = 0; i < WHEEL_LOCAL.length; i += 1) {
            const inNormalSkid = skid.smoking && (skid.wheels === 'all' || i >= 2);
            const inOilSmoke = wheelOnOil[i] === true && oilSkidActive > SKID_SMOKE_THRESHOLD;
            if (!inNormalSkid && !inOilSmoke) {
              continue;
            }
            const pos = lastSkidPos.current[i];
            if (pos) {
              const intensity = Math.max(
                inNormalSkid ? skid.intensity : 0,
                inOilSmoke ? oilSkidActive : 0,
              );
              pushSkidSmoke(pos.x, ROAD_TOP_Y + 0.06, pos.z, intensity, wakeX, 0, wakeZ);
            }
          }
        }
      } else {
        smokeTimer.current = 0;
      }

      if (offroadFx > 0.08) {
        dirtSmokeTimer.current += clampedDt;
        const dirtInterval = 0.11 - offroadFx * 0.05;
        if (dirtSmokeTimer.current >= dirtInterval) {
          dirtSmokeTimer.current = 0;
          const wakeX = linvel.x * 0.4;
          const wakeZ = linvel.z * 0.4;
          for (let i = 0; i < WHEEL_LOCAL.length; i += 1) {
            if (wheelKinds[i] !== 'offroad') {
              continue;
            }
            const pos = lastSkidPos.current[i] ?? prevZoneWheelPos.current[i];
            if (pos) {
              pushSkidSmoke(
                pos.x,
                ROAD_TOP_Y + 0.05,
                pos.z,
                0.25 + offroadFx * 0.45,
                wakeX,
                0.4,
                wakeZ,
              );
            }
          }
        }
      } else {
        dirtSmokeTimer.current = 0;
      }
    }

    tmpDesired
      .copy(tmpForward)
      .multiplyScalar(targetForward)
      .add(tmpRight.clone().multiplyScalar(dampedLateral));

    const desiredHz = Math.hypot(tmpDesired.x, tmpDesired.z);
    const slid = slideAlongWalls(world, rapier, body, tmpDesired);
    const slidHz = Math.hypot(slid.x, slid.z);
    // На земле не даём коллизиям (шины) подбрасывать машину вверх
    body.setLinvel({ x: slid.x, y: Math.min(linvel.y, 0), z: slid.z }, true);

    const steerStrength = computeSteerStrength(forwardSpeed, input.handbrake);
    const angvel = body.angvel();
    const steerSign = Math.sign(forwardSpeed || input.throttle - input.brake || 1);
    let nextYaw = integrateSteerYaw(angvel.y, input.steer, steerStrength, steerSign, clampedDt);
    nextYaw += computeOilYawKick(oilStrength, input.steer, forwardSpeed, lateral);
    body.setAngvel({ x: 0, y: nextYaw, z: 0 }, true);

    tickDriveSfxSample({
      active: true,
      speedMs: speed,
      throttle: input.throttle,
      brake: input.brake,
      handbrake: input.handbrake,
      skidIntensity: Math.max(skid.intensity, oilSkidActive, offroadSkidBoost),
      oilStrength,
      wheelsOnOil,
      offRoadStrength: offroadFx,
      kerbRumble,
      wallScrape: mapWallScrape(desiredHz, slidHz),
      grounded: wheelGrounded,
    });
  });

  const dropSpawn: TVec3 = [
    spawnPosition[0],
    spawnPosition[1] + SPAWN_DROP_HEIGHT,
    spawnPosition[2],
  ];

  return (
    <>
      <RigidBody
        ref={bodyRef}
        name="vehicle"
        position={dropSpawn}
        rotation={[0, spawnRotationY, 0]}
        colliders={false}
        mass={88}
        linearDamping={0.16}
        angularDamping={1.0}
        enabledRotations={[false, true, false]}
        ccd
        canSleep={false}
        friction={0.1}
        restitution={0}
        collisionGroups={VEHICLE_GROUPS}
      >
        <CapsuleCollider
          args={[COLLIDER_HALF_HEIGHT, COLLIDER_RADIUS]}
          position={[0, COLLIDER_Y, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          friction={0.08}
          restitution={0}
          collisionGroups={VEHICLE_GROUPS}
        />
        <group ref={visualRef}>
          <VehicleModel
            vehicleId={vehicleId}
            carSkin={carSkin}
            headlightsOn={headlightsOn}
            driveVisualRef={driveVisualRef}
            headlightLampsRef={headlightLampsRef}
          />
        </group>
      </RigidBody>
      {headlightsOn ? (
        <VehicleHeadlights
          bodyRef={bodyRef}
          vehicleId={vehicleId}
          headlightLampsRef={headlightLampsRef}
        />
      ) : null}
    </>
  );
};

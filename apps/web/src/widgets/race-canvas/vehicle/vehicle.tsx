import { type RefObject, useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useRapier } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { Quaternion, Vector3 } from 'three';
import type { Group, Object3D, SpotLight } from 'three';
import type { TCarSkin } from '@/entities/track';
import type { TVec3 } from '@/entities/track';
import {
  beginCountdown,
  computeSteerStrength,
  dampLateralVelocity,
  getDriveInput,
  getRaceHudSnapshot,
  integrateDriveForward,
  integrateSteerYaw,
  tickRace,
  VEHICLE_MAX_SPEED,
  VEHICLE_REVERSE_MAX,
} from '@/features/race-session';
import { vehiclePalette } from '@/shared/config';
import { VEHICLE_GROUPS, WALL_PROBE_GROUPS } from '@/widgets/race-canvas/lib/collision-groups';
import { ROAD_TOP_Y } from '@/widgets/race-canvas/lib/road-ribbon-geometry';
import { computeSkidIntensity } from '@/widgets/race-canvas/lib/skid-intensity';
import { pushSkidSample, pushSkidSmoke } from '@/widgets/race-canvas/lib/skid-marks-store';
import {
  resetTireHitDamping,
  tickTireHitDamping,
} from '@/widgets/race-canvas/lib/tire-hit-damping';
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
const HEADLIGHT_LOCAL_LEFT: TVec3 = [-0.58, 0.48, 1.55];
const HEADLIGHT_LOCAL_RIGHT: TVec3 = [0.58, 0.48, 1.55];
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
  /** Раскраска кузова / кабины / колёс */
  carSkin: TCarSkin;
  /** Включить фары (ночь) */
  headlightsOn: boolean;
};

type TVehicleHeadlightsProps = {
  /** Ref физического тела для синхронизации фар */
  bodyRef: RefObject<RapierRigidBody | null>;
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
const VehicleHeadlights = ({ bodyRef }: TVehicleHeadlightsProps) => {
  const groupRef = useRef<Group>(null);
  const headlightTargetRef = useRef<Object3D>(null);
  const leftHeadlightRef = useRef<SpotLight>(null);
  const rightHeadlightRef = useRef<SpotLight>(null);

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
    const aim = headlightTargetRef.current;
    const left = leftHeadlightRef.current;
    const right = rightHeadlightRef.current;
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
        position={HEADLIGHT_LOCAL_LEFT}
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
        position={HEADLIGHT_LOCAL_RIGHT}
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

/** Arcade-машина: отзывчивое руление, скольжение вдоль стен */
export const Vehicle = ({
  spawnPosition,
  spawnRotationY,
  resetNonce,
  bodyRef,
  visualRef,
  carSkin,
  headlightsOn,
}: TVehicleProps) => {
  const { world, rapier } = useRapier();
  const lastNonce = useRef(resetNonce);
  const awaitingLand = useRef(true);
  const lastSkidPos = useRef<(TSkidWheelPos | null)[]>([null, null, null, null]);
  const smokeTimer = useRef(0);
  const driveVisualRef = useRef<TVehicleDriveVisual>({
    forwardSpeed: 0,
    steer: 0,
    brake: 0,
  });

  const clearSkidTrail = () => {
    lastSkidPos.current = [null, null, null, null];
    smokeTimer.current = 0;
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
      clearSkidTrail();
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
      return;
    }

    if (hud.status !== 'racing') {
      clearSkidTrail();
      return;
    }

    const clampedDt = Math.min(dt, 1 / 30);
    if (!grounded) {
      clearSkidTrail();
      return;
    }

    let targetForward = integrateDriveForward(forwardSpeed, {
      throttle: input.throttle,
      brake: input.brake,
      handbrake: input.handbrake,
      dt: clampedDt,
    });

    targetForward = Math.max(-REVERSE_MAX, Math.min(MAX_SPEED, targetForward));
    targetForward *= tickTireHitDamping(clampedDt);

    const lateral = tmpVel.dot(tmpRight);
    const dampedLateral = dampLateralVelocity(
      lateral,
      input.handbrake,
      input.throttle,
      clampedDt,
    );

    const { intensity, smoking, wheels } = computeSkidIntensity({
      brake: input.brake,
      throttle: input.throttle,
      handbrake: input.handbrake,
      forwardSpeed,
      lateral,
      grounded: wheelGrounded,
    });

    if (intensity <= 0 || !wheelGrounded) {
      clearSkidTrail();
    } else {
      for (let i = 0; i < WHEEL_LOCAL.length; i += 1) {
        if (wheels === 'rear' && i < 2) {
          lastSkidPos.current[i] = null;
          continue;
        }
        const offset = WHEEL_LOCAL[i]!;
        tmpOrigin.set(offset[0], offset[1], offset[2]).applyQuaternion(tmpQuat);
        const wx = tmpOrigin.x + translation.x;
        const wz = tmpOrigin.z + translation.z;
        const prev = lastSkidPos.current[i];
        if (prev) {
          pushSkidSample(prev.x, prev.z, wx, wz, intensity);
        }
        lastSkidPos.current[i] = { x: wx, z: wz };
      }

      if (smoking) {
        smokeTimer.current += clampedDt;
        const smokeInterval = 0.09 - intensity * 0.055;
        if (smokeTimer.current >= smokeInterval) {
          smokeTimer.current = 0;
          const smokeWheels =
            wheels === 'all' ? ([0, 1, 2, 3] as const) : ([2, 3] as const);
          // Wake: текущая скорость кузова + доля бокового сноса
          const wakeX = linvel.x + tmpRight.x * dampedLateral * 0.25;
          const wakeZ = linvel.z + tmpRight.z * dampedLateral * 0.25;
          for (const wheelIndex of smokeWheels) {
            const pos = lastSkidPos.current[wheelIndex];
            if (pos) {
              pushSkidSmoke(pos.x, ROAD_TOP_Y + 0.06, pos.z, intensity, wakeX, 0, wakeZ);
            }
          }
        }
      } else {
        smokeTimer.current = 0;
      }
    }

    tmpDesired
      .copy(tmpForward)
      .multiplyScalar(targetForward)
      .add(tmpRight.clone().multiplyScalar(dampedLateral));

    const slid = slideAlongWalls(world, rapier, body, tmpDesired);
    // На земле не даём коллизиям (шины) подбрасывать машину вверх
    body.setLinvel({ x: slid.x, y: Math.min(linvel.y, 0), z: slid.z }, true);

    const steerStrength = computeSteerStrength(forwardSpeed, input.handbrake);
    const angvel = body.angvel();
    const steerSign = Math.sign(forwardSpeed || input.throttle - input.brake || 1);
    const nextYaw = integrateSteerYaw(
      angvel.y,
      input.steer,
      steerStrength,
      steerSign,
      clampedDt,
    );
    body.setAngvel({ x: 0, y: nextYaw, z: 0 }, true);
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
            carSkin={carSkin}
            headlightsOn={headlightsOn}
            driveVisualRef={driveVisualRef}
          />
        </group>
      </RigidBody>
      {headlightsOn ? <VehicleHeadlights bodyRef={bodyRef} /> : null}
    </>
  );
};

import { type RefObject, useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useRapier } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { Quaternion, Vector3 } from 'three';
import type { Group, Object3D, SpotLight } from 'three';
import type { CarSkin } from '@/entities/track';
import type { Vec3 } from '@/entities/track';
import {
  beginCountdown,
  computeSteerStrength,
  getDriveInput,
  getRaceHudSnapshot,
  tickRace,
  VEHICLE_MAX_SPEED,
  VEHICLE_REVERSE_MAX,
} from '@/features/race-session';

/** Физические канделы — левая и правая фары (с запасом под decay=2) */
const HEADLIGHT_INTENSITY = 75;
const HEADLIGHT_ANGLE = 0.42;
const HEADLIGHT_PENUMBRA = 0.7;
const HEADLIGHT_DISTANCE = 24;
const HEADLIGHT_DECAY = 2;
const HEADLIGHT_COLOR = '#fff8e0';
/** Прицел: в плоскость асфальта впереди */
const HEADLIGHT_TARGET: Vec3 = [0, -1.0, 11];
const HEADLIGHT_LOCAL_LEFT: Vec3 = [-0.55, 0.5, 1.7];
const HEADLIGHT_LOCAL_RIGHT: Vec3 = [0.55, 0.5, 1.7];
const HEADLIGHT_SHADOW_MAP = 1024;
const HEADLIGHT_SHADOW_NEAR = 0.5;
const HEADLIGHT_SHADOW_BIAS = -0.00002;
const HEADLIGHT_SHADOW_NORMAL_BIAS = 0.02;

type VehicleProps = {
  spawnPosition: Vec3;
  spawnRotationY: number;
  resetNonce: number;
  bodyRef: RefObject<RapierRigidBody | null>;
  carSkin: CarSkin;
  headlightsOn: boolean;
};

type VehicleHeadlightsProps = {
  bodyRef: RefObject<RapierRigidBody | null>;
};

const configureHeadlightShadow = (light: SpotLight) => {
  light.castShadow = true;
  light.shadow.mapSize.set(HEADLIGHT_SHADOW_MAP, HEADLIGHT_SHADOW_MAP);
  light.shadow.bias = HEADLIGHT_SHADOW_BIAS;
  light.shadow.normalBias = HEADLIGHT_SHADOW_NORMAL_BIAS;
  light.shadow.camera.near = HEADLIGHT_SHADOW_NEAR;
  light.shadow.camera.far = HEADLIGHT_DISTANCE;
  light.shadow.camera.updateProjectionMatrix();
};

/** Фары вне RigidBody — иначе shadow map SpotLight не окклюдирует стены */
const VehicleHeadlights = ({ bodyRef }: VehicleHeadlightsProps) => {
  const groupRef = useRef<Group>(null);
  const headlightTargetRef = useRef<Object3D>(null);
  const leftHeadlightRef = useRef<SpotLight>(null);
  const rightHeadlightRef = useRef<SpotLight>(null);

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
    if (right) {
      if (right.target !== aim) {
        right.target = aim;
      }
      configureHeadlightShadow(right);
    }
  };

  useLayoutEffect(() => {
    bindTargets();
  }, []);

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
        color={HEADLIGHT_COLOR}
        castShadow
        shadow-mapSize-width={HEADLIGHT_SHADOW_MAP}
        shadow-mapSize-height={HEADLIGHT_SHADOW_MAP}
        shadow-bias={HEADLIGHT_SHADOW_BIAS}
        shadow-normalBias={HEADLIGHT_SHADOW_NORMAL_BIAS}
        shadow-camera-near={HEADLIGHT_SHADOW_NEAR}
        shadow-camera-far={HEADLIGHT_DISTANCE}
      />
      <spotLight
        ref={rightHeadlightRef}
        position={HEADLIGHT_LOCAL_RIGHT}
        angle={HEADLIGHT_ANGLE}
        penumbra={HEADLIGHT_PENUMBRA}
        intensity={HEADLIGHT_INTENSITY}
        distance={HEADLIGHT_DISTANCE}
        decay={HEADLIGHT_DECAY}
        color={HEADLIGHT_COLOR}
        castShadow
        shadow-mapSize-width={HEADLIGHT_SHADOW_MAP}
        shadow-mapSize-height={HEADLIGHT_SHADOW_MAP}
        shadow-bias={HEADLIGHT_SHADOW_BIAS}
        shadow-normalBias={HEADLIGHT_SHADOW_NORMAL_BIAS}
        shadow-camera-near={HEADLIGHT_SHADOW_NEAR}
        shadow-camera-far={HEADLIGHT_DISTANCE}
      />
    </group>
  );
};

const WHEEL_LOCAL: Vec3[] = [
  [-0.72, 0.05, 1.05],
  [0.72, 0.05, 1.05],
  [-0.72, 0.05, -1.05],
  [0.72, 0.05, -1.05],
];

const MAX_SPEED = VEHICLE_MAX_SPEED;
const REVERSE_MAX = VEHICLE_REVERSE_MAX;
const ACCEL = 52;
const BRAKE = 78;
const STEER_RATE = 5.4;
const STEER_YAW_GAIN = 12;
const LATERAL_GRIP = 13;
/** Горизонтальная капсула ≈ габариты кузова: гладкое скольжение вдоль стен */
const COLLIDER_HALF_X = 0.82;
const COLLIDER_HALF_Z = 1.65;
const COLLIDER_RADIUS = COLLIDER_HALF_X;
const COLLIDER_HALF_HEIGHT = COLLIDER_HALF_Z - COLLIDER_RADIUS;
const COLLIDER_Y = COLLIDER_RADIUS;
/** Запас луча за край коллайдера для раннего slide */
const WALL_PROBE_MARGIN = 0.15;
/** Высота спавна над точкой старта — машина падает на трассу */
const SPAWN_DROP_HEIGHT = 3.2;
/** После касания ждём почти нулевую вертикальную скорость */
const LAND_SETTLE_VY = 1.2;

const elevatedSpawn = (spawnPosition: Vec3): { x: number; y: number; z: number } => ({
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

/** Скользит вдоль стены: убирает нормальную составляющую скорости */
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
    const probeLen =
      Math.abs(dir.dot(tmpForward)) * COLLIDER_HALF_Z +
      Math.abs(dir.dot(tmpRight)) * COLLIDER_HALF_X +
      WALL_PROBE_MARGIN;
    const ray = new rapier.Ray(
      { x: translation.x, y: translation.y + COLLIDER_Y, z: translation.z },
      { x: dir.x, y: 0, z: dir.z },
    );
    const hit = world.castRay(ray, probeLen, true, undefined, undefined, undefined, body);
    if (!hit) {
      continue;
    }
    tmpNormal.set(-dir.x, 0, -dir.z);
    if (tmpNormal.lengthSq() < 0.001) {
      continue;
    }
    tmpNormal.normalize();
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
  carSkin,
  headlightsOn,
}: VehicleProps) => {
  const { world, rapier } = useRapier();
  const lastNonce = useRef(resetNonce);
  const awaitingLand = useRef(true);

  useFrame((_, dt) => {
    const body = bodyRef.current;
    if (!body) {
      return;
    }

    if (lastNonce.current !== resetNonce) {
      lastNonce.current = resetNonce;
      awaitingLand.current = true;
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
    if (awaitingLand.current && hud.status === 'ready') {
      if (wheelGrounded && Math.abs(linvel.y) < LAND_SETTLE_VY) {
        awaitingLand.current = false;
        beginCountdown();
      }
      return;
    }

    if (hud.status !== 'racing') {
      return;
    }

    const clampedDt = Math.min(dt, 1 / 30);
    if (!grounded) {
      return;
    }

    const input = getDriveInput();
    const forwardSpeed = tmpVel.dot(tmpForward);
    let targetForward = forwardSpeed;

    if (input.throttle > 0) {
      targetForward += input.throttle * ACCEL * clampedDt;
    }
    if (input.brake > 0) {
      targetForward -= input.brake * BRAKE * clampedDt;
    }

    targetForward = Math.max(-REVERSE_MAX, Math.min(MAX_SPEED, targetForward));

    const lateral = tmpVel.dot(tmpRight);
    const dampedLateral = lateral * Math.exp(-LATERAL_GRIP * clampedDt);

    tmpDesired
      .copy(tmpForward)
      .multiplyScalar(targetForward)
      .add(tmpRight.clone().multiplyScalar(dampedLateral));

    const slid = slideAlongWalls(world, rapier, body, tmpDesired);
    body.setLinvel({ x: slid.x, y: linvel.y, z: slid.z }, true);

    const steerStrength = computeSteerStrength(forwardSpeed);
    const angvel = body.angvel();

    if (steerStrength <= 0) {
      body.setAngvel({ x: 0, y: angvel.y * 0.12, z: 0 }, true);
    } else {
      const steerSign = Math.sign(forwardSpeed || input.throttle - input.brake || 1);
      const yawDelta = input.steer * STEER_RATE * steerStrength * clampedDt * steerSign;
      body.setAngvel({ x: 0, y: angvel.y * 0.75 + yawDelta * STEER_YAW_GAIN, z: 0 }, true);
    }
  });

  const dropSpawn: Vec3 = [
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
      >
        <CapsuleCollider
          args={[COLLIDER_HALF_HEIGHT, COLLIDER_RADIUS]}
          position={[0, COLLIDER_Y, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          friction={0.08}
          restitution={0}
        />
        <group>
          {/* Ночью кузов не кастит тени: иначе self-shadow режет пучки фар */}
          <mesh position={[0, 0.32, 0.15]} castShadow={!headlightsOn}>
            <boxGeometry args={[1.6, 0.28, 2.9]} />
            <meshStandardMaterial color={carSkin.body} metalness={0.2} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.48, -0.35]} castShadow={!headlightsOn}>
            <boxGeometry args={[1.35, 0.22, 1.1]} />
            <meshStandardMaterial color={carSkin.cabin} metalness={0.1} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.58, -0.35]} castShadow={!headlightsOn}>
            <boxGeometry args={[1.1, 0.12, 0.9]} />
            <meshStandardMaterial color="#88ccff" transparent opacity={0.55} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0.28, 1.55]}>
            <boxGeometry args={[1.5, 0.18, 0.25]} />
            <meshStandardMaterial color={carSkin.body} metalness={0.15} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.28, -1.55]} castShadow={!headlightsOn}>
            <boxGeometry args={[1.5, 0.18, 0.25]} />
            <meshStandardMaterial color={carSkin.body} metalness={0.15} roughness={0.55} />
          </mesh>
          <mesh position={[-0.62, 0.42, -1.35]} castShadow={!headlightsOn}>
            <boxGeometry args={[0.12, 0.1, 0.08]} />
            <meshStandardMaterial color="#ff3333" emissive="#ff2222" emissiveIntensity={0.8} />
          </mesh>
          <mesh position={[0.62, 0.42, -1.35]} castShadow={!headlightsOn}>
            <boxGeometry args={[0.12, 0.1, 0.08]} />
            <meshStandardMaterial color="#ff3333" emissive="#ff2222" emissiveIntensity={0.8} />
          </mesh>
          {headlightsOn ? (
            <>
              <mesh position={[-0.55, 0.38, 1.62]}>
                <boxGeometry args={[0.2, 0.12, 0.08]} />
                <meshStandardMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={0.45} />
              </mesh>
              <mesh position={[0.55, 0.38, 1.62]}>
                <boxGeometry args={[0.2, 0.12, 0.08]} />
                <meshStandardMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={0.45} />
              </mesh>
            </>
          ) : null}
          {WHEEL_LOCAL.map((offset) => (
            <group key={`${offset[0]}-${offset[2]}`} position={[offset[0], 0.2, offset[2]]}>
              <mesh rotation={[0, 0, Math.PI / 2]} castShadow={!headlightsOn}>
                <cylinderGeometry args={[0.28, 0.28, 0.22, 12]} />
                <meshStandardMaterial color={carSkin.wheel} roughness={0.95} />
              </mesh>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.14, 0.14, 0.24, 8]} />
                <meshStandardMaterial color="#aaaaaa" metalness={0.6} roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      </RigidBody>
      {headlightsOn ? <VehicleHeadlights bodyRef={bodyRef} /> : null}
    </>
  );
};

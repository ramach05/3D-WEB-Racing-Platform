import { type RefObject, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useRapier } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { Quaternion, Vector3 } from 'three';
import type { CarSkin } from '@/entities/track';
import type { Vec3 } from '@/entities/track';
import {
  computeSteerStrength,
  getDriveInput,
  getRaceHudSnapshot,
  tickRace,
  VEHICLE_MAX_SPEED,
  VEHICLE_REVERSE_MAX,
} from '@/features/race-session';

type VehicleProps = {
  spawnPosition: Vec3;
  spawnRotationY: number;
  resetNonce: number;
  bodyRef: RefObject<RapierRigidBody | null>;
  carSkin: CarSkin;
  headlightsOn: boolean;
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
const STEER_RATE = 4.2;
const LATERAL_GRIP = 16;
const WALL_PROBE = 1.1;

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
  tmpForward.set(0, 0, -1).applyQuaternion(tmpQuat);
  tmpRight.set(1, 0, 0).applyQuaternion(tmpQuat);

  const probes = [
    tmpForward,
    tmpForward.clone().negate(),
    tmpRight,
    tmpRight.clone().negate(),
  ];

  const result = velocity.clone();

  for (const dir of probes) {
    const ray = new rapier.Ray(
      { x: translation.x, y: translation.y + 0.35, z: translation.z },
      { x: dir.x, y: 0, z: dir.z },
    );
    const hit = world.castRay(ray, WALL_PROBE, true, undefined, undefined, undefined, body);
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

  useFrame((_, dt) => {
    const body = bodyRef.current;
    if (!body) {
      return;
    }

    if (lastNonce.current !== resetNonce) {
      lastNonce.current = resetNonce;
      body.setTranslation({ x: spawnPosition[0], y: spawnPosition[1], z: spawnPosition[2] }, true);
      body.setRotation(
        { x: 0, y: Math.sin(spawnRotationY / 2), z: 0, w: Math.cos(spawnRotationY / 2) },
        true,
      );
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    const rotation = body.rotation();
    tmpQuat.set(rotation.x, rotation.y, rotation.z, rotation.w);
    tmpForward.set(0, 0, -1).applyQuaternion(tmpQuat);
    tmpRight.set(1, 0, 0).applyQuaternion(tmpQuat);

    const linvel = body.linvel();
    tmpVel.set(linvel.x, linvel.y, linvel.z);
    const speed = Math.hypot(linvel.x, linvel.z);
    tickRace(speed * 3.6);

    const hud = getRaceHudSnapshot();
    if (hud.status !== 'racing') {
      return;
    }

    const translation = body.translation();
    let grounded = translation.y < 2.5;
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
        grounded = true;
        break;
      }
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
    const steerSign = Math.sign(forwardSpeed || input.throttle - input.brake || 1);
    const yawDelta = input.steer * STEER_RATE * steerStrength * clampedDt * steerSign;
    const angvel = body.angvel();
    body.setAngvel({ x: 0, y: angvel.y * 0.78 + yawDelta * 9, z: 0 }, true);
  });

  return (
    <RigidBody
      ref={bodyRef}
      name="vehicle"
      position={spawnPosition}
      rotation={[0, spawnRotationY, 0]}
      colliders={false}
      mass={88}
      linearDamping={0.18}
      angularDamping={1.8}
      enabledRotations={[false, true, false]}
      ccd
      canSleep={false}
      friction={0.12}
      restitution={0}
    >
      <CapsuleCollider args={[0.55, 0.38]} position={[0, 0.42, 0]} friction={0.1} restitution={0} />
      <group>
        <mesh position={[0, 0.32, 0.15]} castShadow>
          <boxGeometry args={[1.6, 0.28, 2.9]} />
          <meshStandardMaterial color={carSkin.body} metalness={0.2} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.48, -0.35]} castShadow>
          <boxGeometry args={[1.35, 0.22, 1.1]} />
          <meshStandardMaterial color={carSkin.cabin} metalness={0.1} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.58, -0.35]} castShadow>
          <boxGeometry args={[1.1, 0.12, 0.9]} />
          <meshStandardMaterial color="#88ccff" transparent opacity={0.55} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.28, 1.55]} castShadow>
          <boxGeometry args={[1.5, 0.18, 0.25]} />
          <meshStandardMaterial color={carSkin.body} metalness={0.15} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.28, -1.55]} castShadow>
          <boxGeometry args={[1.5, 0.18, 0.25]} />
          <meshStandardMaterial color={carSkin.body} metalness={0.15} roughness={0.55} />
        </mesh>
        <mesh position={[-0.62, 0.42, -1.35]} castShadow>
          <boxGeometry args={[0.12, 0.1, 0.08]} />
          <meshStandardMaterial color="#ff3333" emissive="#ff2222" emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[0.62, 0.42, -1.35]} castShadow>
          <boxGeometry args={[0.12, 0.1, 0.08]} />
          <meshStandardMaterial color="#ff3333" emissive="#ff2222" emissiveIntensity={0.8} />
        </mesh>
        {headlightsOn ? (
          <>
            <mesh position={[-0.55, 0.38, 1.62]}>
              <boxGeometry args={[0.2, 0.12, 0.08]} />
              <meshStandardMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={1.2} />
            </mesh>
            <mesh position={[0.55, 0.38, 1.62]}>
              <boxGeometry args={[0.2, 0.12, 0.08]} />
              <meshStandardMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={1.2} />
            </mesh>
            <spotLight
              position={[-0.55, 0.45, 1.7]}
              angle={0.45}
              penumbra={0.4}
              intensity={2.5}
              distance={35}
              color="#fff8e0"
              castShadow
            />
            <spotLight
              position={[0.55, 0.45, 1.7]}
              angle={0.45}
              penumbra={0.4}
              intensity={2.5}
              distance={35}
              color="#fff8e0"
              castShadow
            />
          </>
        ) : null}
        {WHEEL_LOCAL.map((offset) => (
          <group key={`${offset[0]}-${offset[2]}`} position={[offset[0], 0.2, offset[2]]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
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
  );
};

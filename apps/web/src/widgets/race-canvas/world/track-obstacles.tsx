import { useEffect } from 'react';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import type { CollisionEnterPayload, RapierRigidBody } from '@react-three/rapier';
import type { TTrackObstacle, TVec3 } from '@/entities/track';
import { mapImpactFromSpeed, pulseDriveImpact } from '@/features/race-audio';
import {
  BARREL_MASS,
  clampBarrelVelocity,
  computeBarrelBounce,
} from '@/widgets/race-canvas/lib/barrel-impact';
import { pulseCameraShake } from '@/widgets/race-canvas/lib/camera-shake';
import { TIRE_GROUPS } from '@/widgets/race-canvas/lib/collision-groups';
import { isObstacleUnderCar } from '@/widgets/race-canvas/lib/obstacle-under-car';
import { registerTireHit } from '@/widgets/race-canvas/lib/tire-hit-damping';
import {
  isObstacleHitThrottled,
  resetObstacleHitThrottle,
} from '@/widgets/race-canvas/lib/tire-hit-throttle';

type TTrackObstaclesProps = {
  /** Obstacle list (tire stacks / barrels) */
  obstacles: TTrackObstacle[];
  /** Restart counter — resets obstacle poses */
  resetNonce: number;
};

/** Track tire (averaged 315/80R22.5): outer diameter ~1.2 m, section ~0.32 m, bore ~0.56 m (22.5" rim) */
const TIRE_RADIUS = 0.44;
const TIRE_TUBE = 0.16;
/** Narrow light band on the outer sidewall (slightly larger than the main torus) */
const TIRE_SIDEWALL_RADIUS = TIRE_RADIUS + 0.025;
const TIRE_SIDEWALL_TUBE = 0.06;
const TIRE_STACK_MASS = 12;
const TIRE_MASS = TIRE_STACK_MASS / 3;
const TIRE_TIER_COUNT = 3;
/** Tier spacing = flat tire width (2 × tube) with slight contact compression */
const TIRE_TIER_SPACING = 0.35;
/** Bottom tire center from stack center (stack height 1.05, bottom tire rests on the ground) */
const TIRE_BASE_Y = 0.16 - 1.05 / 2;
/**
 * Single tire collider — cylinder over the torus outer extent. A cuboid stuck its corners
 * ~25 cm past the visible circle: the car caught invisible corners and jittered on grazes.
 */
const TIRE_COLLIDER_RADIUS = TIRE_RADIUS + TIRE_TUBE;
const TIRE_COLLIDER_HALF_HEIGHT = 0.17;
/** Below this car speed it is a graze, not an impact: only push the obstacle off the bumper */
const HIT_MIN_SPEED = 0.5;
/** Nominal slow-graze speed for the tire push-off impulse, m/s */
const TIRE_TOUCH_IMPULSE_SPEED = 6;
const TIRE_HIT_FACTOR = 0.8;
const TIRE_IMPULSE_SCALE = 0.2;
const TIRE_TORQUE_SCALE = 0.08;
const TIRE_UP_IMPULSE_SCALE = 0.12;
const TIRE_LATERAL_SCATTER_SCALE = 0.18;

const TIRE_RUBBER = '#3e3e44';
const TIRE_SIDEWALL = '#6a6a72';
const BARREL_BODY = '#c45c12';
const BARREL_BAND = '#3a3a3c';
const BARREL_LID = '#2a2a2c';

const TIRE_TIER_OFFSETS = Array.from(
  { length: TIRE_TIER_COUNT },
  (_, tier) => TIRE_BASE_Y + tier * TIRE_TIER_SPACING,
);

/** One tire — mesh without physics */
const TireVisual = () => (
  <group rotation={[Math.PI / 2, 0, 0]}>
    <mesh castShadow receiveShadow>
      <torusGeometry args={[TIRE_RADIUS, TIRE_TUBE, 10, 18]} />
      <meshStandardMaterial color={TIRE_RUBBER} roughness={0.86} metalness={0} />
    </mesh>
    {/* Sidewall without cast — the main torus gives the silhouette, less work in shadow passes */}
    <mesh>
      <torusGeometry args={[TIRE_SIDEWALL_RADIUS, TIRE_SIDEWALL_TUBE, 8, 18]} />
      <meshStandardMaterial color={TIRE_SIDEWALL} roughness={0.88} metalness={0} />
    </mesh>
  </group>
);

/** Fuel barrel visual — standard euro barrel: ⌀0.6 × 0.9 m, rolling hoops near top and bottom heads */
const FuelBarrelVisual = () => (
  <group>
    <mesh castShadow receiveShadow position={[0, 0, 0]}>
      <cylinderGeometry args={[0.29, 0.29, 0.9, 16]} />
      <meshStandardMaterial color={BARREL_BODY} roughness={0.55} metalness={0.45} />
    </mesh>
    {/* Hoops and lid without cast — the body already reads as a clear silhouette */}
    <mesh position={[0, 0.27, 0]}>
      <cylinderGeometry args={[0.305, 0.305, 0.09, 16]} />
      <meshStandardMaterial color={BARREL_BAND} roughness={0.7} metalness={0.2} />
    </mesh>
    <mesh position={[0, -0.27, 0]}>
      <cylinderGeometry args={[0.305, 0.305, 0.09, 16]} />
      <meshStandardMaterial color={BARREL_BAND} roughness={0.7} metalness={0.2} />
    </mesh>
    <mesh position={[0, 0.44, 0]}>
      <cylinderGeometry args={[0.27, 0.27, 0.05, 16]} />
      <meshStandardMaterial color={BARREL_LID} roughness={0.4} metalness={0.55} />
    </mesh>
  </group>
);

type TObstacleHit = {
  /** Vehicle body */
  vehicleBody: RapierRigidBody;
  /** Obstacle body */
  obstacleBody: RapierRigidBody;
  /** Car speed in the XZ plane, m/s (on a graze — nominal, for the push-off impulse) */
  speed: number;
  /** Unit car travel direction */
  dirX: number;
  dirZ: number;
};

/**
 * Common hit part: sound, shake, speed penalty. At low speed it is not null but a "graze":
 * direction "car -> obstacle" so the tire/barrel rolls off the bumper instead of stalling
 * the car (impulse computed from minImpulseSpeed).
 * null — collision not with the car, or degenerate direction.
 */
const beginObstacleHit = (
  payload: CollisionEnterPayload,
  minImpulseSpeed: number,
): TObstacleHit | null => {
  if (payload.other.rigidBodyObject?.name !== 'vehicle') {
    return null;
  }

  const vehicleBody = payload.other.rigidBody;
  const obstacleBody = payload.target.rigidBody;
  if (!vehicleBody || !obstacleBody) {
    return null;
  }

  const vel = vehicleBody.linvel();
  const speed = Math.hypot(vel.x, vel.z);
  // Re-entry of the same body within the churn window: push-off impulse only, no penalty/shake
  if (!isObstacleHitThrottled(obstacleBody.handle, performance.now())) {
    registerTireHit(TIRE_HIT_FACTOR);
    const impact = mapImpactFromSpeed(speed);
    pulseDriveImpact(impact);
    pulseCameraShake(impact);
  }
  if (speed >= HIT_MIN_SPEED) {
    const invSpeed = 1 / speed;
    return { vehicleBody, obstacleBody, speed, dirX: vel.x * invSpeed, dirZ: vel.z * invSpeed };
  }

  const carPos = vehicleBody.translation();
  const obstaclePos = obstacleBody.translation();
  const dirX = obstaclePos.x - carPos.x;
  const dirZ = obstaclePos.z - carPos.z;
  const len = Math.hypot(dirX, dirZ);
  if (len < 1e-6) {
    return null;
  }
  return { vehicleBody, obstacleBody, speed: minImpulseSpeed, dirX: dirX / len, dirZ: dirZ / len };
};

/** Keep the car from flying up on collision reaction */
const pinVehicleToGround = (vehicleBody: RapierRigidBody): void => {
  const vel = vehicleBody.linvel();
  if (vel.y > 0) {
    vehicleBody.setLinvel({ x: vel.x, y: 0, z: vel.z }, true);
  }
};

/** Tire hit: per-tier scatter, upper tiers tossed harder */
const handleTireHit = (payload: CollisionEnterPayload, tier: number): void => {
  const hit = beginObstacleHit(payload, TIRE_TOUCH_IMPULSE_SPEED);
  if (!hit) {
    return;
  }

  const { obstacleBody, speed, dirX, dirZ } = hit;
  const impulse = TIRE_MASS * speed * TIRE_IMPULSE_SCALE;

  let impulseX = dirX * impulse;
  let impulseZ = dirZ * impulse;

  // Upper tires get tossed harder; slight lateral scatter within the tier
  const tierNorm = tier / (TIRE_TIER_COUNT - 1);
  const impulseY = impulse * TIRE_UP_IMPULSE_SCALE * (0.35 + tierNorm);
  const side = tier % 2 === 0 ? 1 : -1;
  const scatter = impulse * TIRE_LATERAL_SCATTER_SCALE * (0.4 + tierNorm);
  impulseX += -dirZ * side * scatter;
  impulseZ += dirX * side * scatter;

  obstacleBody.applyImpulse({ x: impulseX, y: impulseY, z: impulseZ }, true);
  obstacleBody.applyTorqueImpulse(
    {
      x: -dirZ * impulse * TIRE_TORQUE_SCALE,
      y: (tier % 2 === 0 ? 1 : -1) * impulse * TIRE_TORQUE_SCALE * 0.5,
      z: dirX * impulse * TIRE_TORQUE_SCALE,
    },
    true,
  );

  // Tire under the chassis (car rolling over the stack) — do not push: the solver should
  // lift the body up, otherwise the car is pressed into the tires and jitters/hangs.
  const carPos = hit.vehicleBody.translation();
  const q = hit.vehicleBody.rotation();
  // Body forward = q * (0,0,1), projected onto XZ
  const fx = 2 * (q.x * q.z + q.w * q.y);
  const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  if (
    !isObstacleUnderCar({
      carPosition: carPos,
      carForward: { x: fx, z: fz },
      obstaclePosition: obstacleBody.translation(),
    })
  ) {
    pinVehicleToGround(hit.vehicleBody);
  }
};

/**
 * Barrel hit: bounce is computed explicitly (see lib/barrel-impact). Lateral velocity
 * pulls the barrel out from under the bumper, the impulse lever arm produces a tumble,
 * the cylindrical collider gives rolling. Without the lateral component the barrel sticks
 * to the bumper: the car gets a target speed every frame, i.e. it is weightless to the solver.
 */
const handleBarrelHit = (payload: CollisionEnterPayload, sideBias: 1 | -1): void => {
  const hit = beginObstacleHit(payload, HIT_MIN_SPEED);
  if (!hit) {
    return;
  }

  const { obstacleBody, speed, dirX, dirZ } = hit;
  const bounce = computeBarrelBounce({
    carPosition: hit.vehicleBody.translation(),
    carVelocity: { x: dirX * speed, z: dirZ * speed },
    carSpeed: speed,
    barrelPosition: obstacleBody.translation(),
    sideBias,
  });

  obstacleBody.applyImpulseAtPoint(bounce.impulse, bounce.point, true);
  obstacleBody.applyTorqueImpulse(bounce.torqueImpulse, true);

  const clamped = clampBarrelVelocity(
    obstacleBody.linvel(),
    obstacleBody.angvel(),
    bounce.speedCap,
  );
  obstacleBody.setLinvel(clamped.linvel, true);
  obstacleBody.setAngvel(clamped.angvel, true);

  pinVehicleToGround(hit.vehicleBody);
};

type TTireStackProps = {
  /** Stack center in world space */
  position: TVec3;
  /** Yaw rotation */
  rotationY: number;
  /** Obstacle index for keys */
  stackIndex: number;
};

/** Three independent tires — scatter on impact */
const TireStack = ({ position, rotationY, stackIndex }: TTireStackProps) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    {TIRE_TIER_OFFSETS.map((offsetY, tier) => (
      <RigidBody
        key={`tire-${stackIndex}-${tier}`}
        name={`obstacle-tire-${stackIndex}-${tier}`}
        type="dynamic"
        colliders={false}
        position={[0, offsetY, 0]}
        mass={TIRE_MASS}
        restitution={0}
        friction={0.85}
        linearDamping={0.55}
        angularDamping={0.45}
        canSleep
        ccd
        collisionGroups={TIRE_GROUPS}
        onCollisionEnter={(payload) => handleTireHit(payload, tier)}
      >
        <CylinderCollider
          args={[TIRE_COLLIDER_HALF_HEIGHT, TIRE_COLLIDER_RADIUS]}
          friction={0.85}
          restitution={0}
          collisionGroups={TIRE_GROUPS}
        />
        <TireVisual />
      </RigidBody>
    ))}
  </group>
);

/** Obstacles near the walls — dynamic, knock away on impact */
export const TrackObstacles = ({ obstacles, resetNonce }: TTrackObstaclesProps) => {
  // Restart recreates bodies — throttle windows for stale handles are not needed
  useEffect(() => {
    resetObstacleHitThrottle();
  }, [resetNonce]);

  if (obstacles.length === 0) {
    return null;
  }

  return (
    <group key={`obstacles-${resetNonce}`}>
      {obstacles.map((obstacle, index) => {
        if (obstacle.kind === 'tireStack') {
          return (
            <TireStack
              key={`obstacle-tireStack-${index}`}
              position={obstacle.position}
              rotationY={obstacle.rotationY}
              stackIndex={index}
            />
          );
        }

        return (
          <RigidBody
            key={`obstacle-fuelBarrel-${index}`}
            name={`obstacle-${index}`}
            type="dynamic"
            colliders={false}
            position={obstacle.position}
            rotation={[0, obstacle.rotationY, 0]}
            restitution={0}
            friction={0.85}
            linearDamping={0.35}
            angularDamping={0.6}
            canSleep
            ccd
            collisionGroups={TIRE_GROUPS}
            onCollisionEnter={(payload) => handleBarrelHit(payload, index % 2 === 0 ? 1 : -1)}
          >
            {/* Mass goes on the collider: on RigidBody it is not applied, and rotational
                inertia is derived from the shape — otherwise the barrel is nearly weightless */}
            <CylinderCollider
              args={[obstacle.size[1] / 2, obstacle.size[0] / 2]}
              mass={BARREL_MASS}
              friction={0.85}
              restitution={0}
              collisionGroups={TIRE_GROUPS}
            />
            <FuelBarrelVisual />
          </RigidBody>
        );
      })}
    </group>
  );
};

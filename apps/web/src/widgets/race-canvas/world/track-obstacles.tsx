import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { CollisionEnterPayload } from '@react-three/rapier';
import type { TTrackObstacle } from '@/entities/track';
import { scenePalette } from '@/shared/config';
import { TIRE_GROUPS } from '@/widgets/race-canvas/lib/collision-groups';
import { registerTireHit } from '@/widgets/race-canvas/lib/tire-hit-damping';

type TTrackObstaclesProps = {
  obstacles: TTrackObstacle[];
  resetNonce: number;
};

const TIRE_RADIUS = 0.38;
const TIRE_TUBE = 0.14;
const TIRE_MASS = 12;
const TIRE_HIT_FACTOR = 0.45;
const TIRE_IMPULSE_SCALE = 0.2;
const TIRE_TORQUE_SCALE = 0.08;

const TireStackVisual = () => (
  <group>
    {[0, 1, 2].map((tier) => (
      <mesh
        key={tier}
        castShadow
        receiveShadow
        position={[0, -0.4 + tier * 0.38, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[TIRE_RADIUS, TIRE_TUBE, 10, 18]} />
        <meshStandardMaterial color={scenePalette.obstacle} roughness={0.92} metalness={0} />
      </mesh>
    ))}
  </group>
);

const handleTireHit = (payload: CollisionEnterPayload) => {
  const otherName = payload.other.rigidBodyObject?.name;
  if (otherName !== 'vehicle') {
    return;
  }

  const vehicleBody = payload.other.rigidBody;
  const tireBody = payload.target.rigidBody;
  if (!vehicleBody || !tireBody) {
    return;
  }

  registerTireHit(TIRE_HIT_FACTOR);

  const vel = vehicleBody.linvel();
  const speed = Math.hypot(vel.x, vel.z);
  if (speed < 0.5) {
    return;
  }

  const invSpeed = 1 / speed;
  const dirX = vel.x * invSpeed;
  const dirZ = vel.z * invSpeed;
  const impulse = TIRE_MASS * speed * TIRE_IMPULSE_SCALE;

  tireBody.applyImpulse({ x: dirX * impulse, y: 0, z: dirZ * impulse }, true);
  tireBody.applyTorqueImpulse(
    { x: -dirZ * impulse * TIRE_TORQUE_SCALE, y: 0, z: dirX * impulse * TIRE_TORQUE_SCALE },
    true,
  );

  // Не даём машине взлететь от реакции столкновения
  const vehicleVel = vehicleBody.linvel();
  if (vehicleVel.y > 0) {
    vehicleBody.setLinvel({ x: vehicleVel.x, y: 0, z: vehicleVel.z }, true);
  }
};

/** Стопки шин у стенок — dynamic, отлетают при ударе */
export const TrackObstacles = ({ obstacles, resetNonce }: TTrackObstaclesProps) => {
  if (obstacles.length === 0) {
    return null;
  }

  return (
    <group key={`tires-${resetNonce}`}>
      {obstacles.map((obstacle, index) => (
        <RigidBody
          key={`obstacle-${obstacle.kind}-${index}`}
          name={`tire-${index}`}
          type="dynamic"
          colliders={false}
          position={obstacle.position}
          rotation={[0, obstacle.rotationY, 0]}
          mass={TIRE_MASS}
          restitution={0}
          friction={0.85}
          linearDamping={0.55}
          angularDamping={0.7}
          canSleep
          ccd
          collisionGroups={TIRE_GROUPS}
          onCollisionEnter={handleTireHit}
        >
          <CuboidCollider
            args={[obstacle.size[0] / 2, obstacle.size[1] / 2, obstacle.size[2] / 2]}
            friction={0.85}
            restitution={0}
            collisionGroups={TIRE_GROUPS}
          />
          <TireStackVisual />
        </RigidBody>
      ))}
    </group>
  );
};

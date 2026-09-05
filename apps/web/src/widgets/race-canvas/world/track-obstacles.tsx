import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { TrackObstacle } from '@/entities/track';

type TrackObstaclesProps = {
  obstacles: TrackObstacle[];
};

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
        <torusGeometry args={[0.38, 0.14, 10, 18]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
      </mesh>
    ))}
  </group>
);

/** Стопки шин у стенок с cuboid-коллайдерами */
export const TrackObstacles = ({ obstacles }: TrackObstaclesProps) => {
  if (obstacles.length === 0) {
    return null;
  }

  return (
    <group>
      {obstacles.map((obstacle, index) => (
        <RigidBody
          key={`obstacle-${obstacle.kind}-${index}`}
          type="fixed"
          colliders={false}
          position={obstacle.position}
          rotation={[0, obstacle.rotationY, 0]}
          restitution={0}
          friction={0.2}
        >
          <CuboidCollider
            args={[obstacle.size[0] / 2, obstacle.size[1] / 2, obstacle.size[2] / 2]}
            friction={0.2}
            restitution={0}
          />
          <TireStackVisual />
        </RigidBody>
      ))}
    </group>
  );
};

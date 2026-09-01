import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { IntersectionEnterPayload } from '@react-three/rapier';
import type { TrackConfig } from '@/entities/track';
import { getRaceHudSnapshot, registerCheckpoint } from '@/features/race-session';

type TrackWorldProps = {
  config: TrackConfig;
  onFinished: () => void;
};

/** Если пересечение с машиной — засчитываем чекпоинт */
const handleCheckpointEnter = (
  index: number,
  payload: IntersectionEnterPayload,
  onFinished: () => void,
): void => {
  const name = payload.other.rigidBodyObject?.name;
  if (name !== 'vehicle') {
    return;
  }
  if (getRaceHudSnapshot().status !== 'racing') {
    return;
  }
  const finished = registerCheckpoint(index);
  if (finished) {
    onFinished();
  }
};

/** Дорога (визуал), единый пол и стены с низким трением */
export const TrackWorld = ({ config, onFinished }: TrackWorldProps) => {
  const { palette } = config;

  return (
    <group>
      <RigidBody type="fixed" colliders={false} friction={0.9}>
        <CuboidCollider args={[500, 0.15, 500]} position={[0, -0.05, 0]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
          <planeGeometry args={[1000, 1000]} />
          <meshStandardMaterial color={palette.ground} />
        </mesh>
      </RigidBody>

      {config.segments.map((segment, index) => (
        <mesh
          key={`seg-${index}`}
          position={segment.position}
          rotation={[0, segment.rotationY, 0]}
          receiveShadow
        >
          <boxGeometry args={[...segment.size]} />
          <meshStandardMaterial color={palette.road} roughness={0.9} />
        </mesh>
      ))}

      {config.walls.map((wall, index) => (
        <RigidBody
          key={`wall-${index}`}
          type="fixed"
          colliders={false}
          position={wall.position}
          rotation={[0, wall.rotationY, 0]}
          restitution={0}
          friction={0}
        >
          <CuboidCollider
            args={[wall.size[0] / 2, wall.size[1] / 2, wall.size[2] / 2]}
            friction={0}
            restitution={0}
          />
          <mesh castShadow>
            <boxGeometry args={[...wall.size]} />
            <meshStandardMaterial
              color={palette.wall}
              emissive={palette.accent}
              emissiveIntensity={0.15}
              roughness={0.65}
            />
          </mesh>
        </RigidBody>
      ))}

      {config.checkpoints.map((checkpoint, index) => (
        <RigidBody
          key={`cp-${index}`}
          type="fixed"
          colliders={false}
          position={checkpoint.position}
          rotation={[0, checkpoint.rotationY, 0]}
          sensor
        >
          <CuboidCollider
            args={[checkpoint.size[0] / 2, checkpoint.size[1] / 2, checkpoint.size[2] / 2]}
            sensor
            onIntersectionEnter={(payload) => handleCheckpointEnter(index, payload, onFinished)}
          />
          <mesh>
            <boxGeometry args={[...checkpoint.size]} />
            <meshStandardMaterial
              color={index === config.checkpoints.length - 1 ? palette.accent : palette.wall}
              transparent
              opacity={0.14}
            />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
};

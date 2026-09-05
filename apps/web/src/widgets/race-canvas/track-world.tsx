import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { DoubleSide } from 'three';
import type { TrackConfig } from '@/entities/track';
import { TrackObstacles } from './track-obstacles';

type TrackWorldProps = {
  config: TrackConfig;
};

/** Дорога (визуал), единый пол и стены с низким трением */
export const TrackWorld = ({ config }: TrackWorldProps) => {
  const { palette } = config;
  const isNight = config.timeOfDay === 'night';
  const roadRoughness = isNight ? 0.75 : 0.9;
  const wallEmissiveIntensity = isNight ? 0.05 : 0.15;
  const wallRoughness = isNight ? 0.45 : 0.65;
  const wallMetalness = isNight ? 0.2 : 0;

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
          <meshStandardMaterial color={palette.road} roughness={roadRoughness} />
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
          {/* Визуал чуть глубже в пол — иначе SpotLight протекает под нижней кромкой */}
          <mesh castShadow receiveShadow position={[0, -0.12, 0]}>
            <boxGeometry args={[wall.size[0], wall.size[1] + 0.24, wall.size[2]]} />
            <meshStandardMaterial
              color={palette.wall}
              emissive={palette.accent}
              emissiveIntensity={wallEmissiveIntensity}
              roughness={wallRoughness}
              metalness={wallMetalness}
              shadowSide={DoubleSide}
            />
          </mesh>
        </RigidBody>
      ))}

      <TrackObstacles obstacles={config.obstacles} />
    </group>
  );
};

import { useEffect, useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { DoubleSide, type Texture } from 'three';
import type { TTrackConfig, TVec3 } from '@/entities/track';
import {
  ASPHALT_TILE_SIZE,
  GROUND_TILE_SIZE,
  cloneAsphaltMapForSegment,
  cloneMapForSize,
  createAsphaltRoughnessMap,
  createAsphaltTexture,
  createGroundTexture,
} from '../lib/asphalt-texture';
import { WORLD_GROUPS } from '../lib/collision-groups';
import { TrackObstacles } from './track-obstacles';

type TTrackWorldProps = {
  config: TTrackConfig;
  resetNonce: number;
};

type TRoadSegmentMeshProps = {
  asphaltSource: Texture;
  roughnessSource: Texture;
  position: TVec3;
  size: TVec3;
  rotationY: number;
  roadColor: string;
  roadRoughness: number;
};

const RoadSegmentMesh = ({
  asphaltSource,
  roughnessSource,
  position,
  size,
  rotationY,
  roadColor,
  roadRoughness,
}: TRoadSegmentMeshProps) => {
  const roadWidth = size[0];
  const roadLength = size[2];

  const maps = useMemo(() => {
    const map = cloneAsphaltMapForSegment(asphaltSource, roadWidth, roadLength);
    const roughnessMap = cloneMapForSize(roughnessSource, roadWidth, roadLength, ASPHALT_TILE_SIZE);
    return { map, roughnessMap };
  }, [asphaltSource, roughnessSource, roadWidth, roadLength]);

  useEffect(
    () => () => {
      maps.map.dispose();
      maps.roughnessMap.dispose();
    },
    [maps],
  );

  return (
    <mesh position={position} rotation={[0, rotationY, 0]} receiveShadow>
      <boxGeometry args={[...size]} />
      <meshStandardMaterial
        color={roadColor}
        map={maps.map}
        roughnessMap={maps.roughnessMap}
        roughness={roadRoughness}
        metalness={0.04}
      />
    </mesh>
  );
};

/** Дорога (визуал), единый пол и стены с низким трением */
export const TrackWorld = ({ config, resetNonce }: TTrackWorldProps) => {
  const { palette } = config;
  const isNight = config.timeOfDay === 'night';
  const roadRoughness = isNight ? 0.78 : 0.82;
  const groundRoughness = isNight ? 0.88 : 0.95;
  const wallEmissiveIntensity = isNight ? 0.02 : 0.15;
  const wallRoughness = isNight ? 0.82 : 0.65;
  const wallMetalness = isNight ? 0.04 : 0;

  const asphaltSource = useMemo(() => createAsphaltTexture(512), []);
  const roughnessSource = useMemo(() => createAsphaltRoughnessMap(512), []);
  const groundSource = useMemo(() => createGroundTexture(512), []);

  const groundMap = useMemo(
    () => cloneMapForSize(groundSource, 1000, 1000, GROUND_TILE_SIZE),
    [groundSource],
  );

  useEffect(
    () => () => {
      asphaltSource.dispose();
      roughnessSource.dispose();
      groundSource.dispose();
      groundMap.dispose();
    },
    [asphaltSource, roughnessSource, groundSource, groundMap],
  );

  return (
    <group>
      <RigidBody type="fixed" colliders={false} friction={0.9} collisionGroups={WORLD_GROUPS}>
        <CuboidCollider
          args={[500, 0.15, 500]}
          position={[0, -0.05, 0]}
          collisionGroups={WORLD_GROUPS}
        />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
          <planeGeometry args={[1000, 1000]} />
          <meshStandardMaterial
            color={palette.ground}
            map={groundMap}
            roughness={groundRoughness}
            metalness={0}
          />
        </mesh>
      </RigidBody>

      {config.segments.map((segment, index) => (
        <RoadSegmentMesh
          key={`seg-${index}`}
          asphaltSource={asphaltSource}
          roughnessSource={roughnessSource}
          position={segment.position}
          size={segment.size}
          rotationY={segment.rotationY}
          roadColor={palette.road}
          roadRoughness={roadRoughness}
        />
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
          collisionGroups={WORLD_GROUPS}
        >
          <CuboidCollider
            args={[wall.size[0] / 2, wall.size[1] / 2, wall.size[2] / 2]}
            friction={0}
            restitution={0}
            collisionGroups={WORLD_GROUPS}
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

      <TrackObstacles obstacles={config.obstacles} resetNonce={resetNonce} />
    </group>
  );
};

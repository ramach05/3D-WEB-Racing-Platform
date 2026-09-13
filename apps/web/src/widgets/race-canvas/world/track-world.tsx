import { useEffect, useMemo } from 'react';
import { CuboidCollider, HeightfieldCollider, RigidBody } from '@react-three/rapier';
import { DoubleSide } from 'three';
import type { TTrackConfig } from '@/entities/track';
import {
  ASPHALT_TILE_SIZE,
  GROUND_TILE_SIZE,
  cloneMapForSize,
  createAsphaltRoughnessMap,
  createAsphaltTexture,
  createGroundTexture,
} from '@/widgets/race-canvas/lib/asphalt-texture';
import { WORLD_GROUPS } from '@/widgets/race-canvas/lib/collision-groups';
import { buildRoadRibbonGeometry } from '@/widgets/race-canvas/lib/road-ribbon-geometry';
import {
  buildTerrainGeometry,
  buildTerrainHeightfieldArgs,
} from '@/widgets/race-canvas/lib/terrain-geometry';
import { TRACK_TERRAIN, terrainSeedForSlug } from '@/widgets/race-canvas/lib/terrain-height';
import { TrackObstacles } from './track-obstacles';

type TTrackWorldProps = {
  /** Конфиг трассы: стены, препятствия, centerline */
  config: TTrackConfig;
  /** Счётчик рестарта — пересоздаёт dynamic-шины */
  resetNonce: number;
};

type TRoadSurfaceProps = {
  /** Точки центральной линии */
  centerline: TTrackConfig['centerline'];
  /** Ширина дороги */
  roadWidth: number;
  /** Цвет дороги из палитры */
  roadColor: string;
  /** Базовая roughness материала */
  roadRoughness: number;
};

/** Непрерывный асфальт по centerline — без z-fighting на стыках сегментов */
const RoadSurface = ({ centerline, roadWidth, roadColor, roadRoughness }: TRoadSurfaceProps) => {
  const asphaltSource = useMemo(() => createAsphaltTexture(512), []);
  const roughnessSource = useMemo(() => createAsphaltRoughnessMap(512), []);

  const ribbon = useMemo(
    () => buildRoadRibbonGeometry(centerline, roadWidth),
    [centerline, roadWidth],
  );

  const maps = useMemo(() => {
    const map = cloneMapForSize(asphaltSource, roadWidth, ribbon.pathLength, ASPHALT_TILE_SIZE);
    const roughnessMap = cloneMapForSize(
      roughnessSource,
      roadWidth,
      ribbon.pathLength,
      ASPHALT_TILE_SIZE,
    );
    return { map, roughnessMap };
  }, [asphaltSource, roughnessSource, roadWidth, ribbon.pathLength]);

  // Освобождает геометрию и клоны текстур при размонтировании.
  useEffect(
    () => () => {
      ribbon.geometry.dispose();
      maps.map.dispose();
      maps.roughnessMap.dispose();
      asphaltSource.dispose();
      roughnessSource.dispose();
    },
    [ribbon, maps, asphaltSource, roughnessSource],
  );

  if (ribbon.pathLength <= 0) {
    return null;
  }

  return (
    <mesh geometry={ribbon.geometry} receiveShadow>
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
  const roadRoughness = isNight ? 0.78 : 0.74;
  const groundRoughness = isNight ? 0.88 : 0.95;
  const wallEmissiveIntensity = isNight ? 0.02 : 0.15;
  const wallRoughness = isNight ? 0.82 : 0.65;
  const wallMetalness = isNight ? 0.04 : 0;
  const terrainSeed = terrainSeedForSlug(config.slug);
  const groundWorldSize = TRACK_TERRAIN.worldSize;
  const terrainY = TRACK_TERRAIN.yOffset;

  const groundSource = useMemo(() => createGroundTexture(512), []);

  const groundMap = useMemo(
    () => cloneMapForSize(groundSource, groundWorldSize, groundWorldSize, GROUND_TILE_SIZE),
    [groundSource, groundWorldSize],
  );

  const terrainGeometry = useMemo(
    () =>
      buildTerrainGeometry({
        centerline: config.centerline,
        roadWidth: config.roadWidth,
        seed: terrainSeed,
      }),
    [config.centerline, config.roadWidth, terrainSeed],
  );

  const terrainHeightfield = useMemo(
    () =>
      buildTerrainHeightfieldArgs({
        centerline: config.centerline,
        roadWidth: config.roadWidth,
        seed: terrainSeed,
      }),
    [config.centerline, config.roadWidth, terrainSeed],
  );

  // Освобождает исходные текстуры пола и heightfield при размонтировании.
  useEffect(
    () => () => {
      groundSource.dispose();
      groundMap.dispose();
      terrainGeometry.dispose();
    },
    [groundSource, groundMap, terrainGeometry],
  );

  return (
    <group>
      <RigidBody type="fixed" colliders={false} friction={0.9} collisionGroups={WORLD_GROUPS}>
        <CuboidCollider
          args={[500, 0.15, 500]}
          position={[0, -0.05, 0]}
          collisionGroups={WORLD_GROUPS}
        />
        <HeightfieldCollider
          args={terrainHeightfield}
          position={[0, terrainY, 0]}
          friction={0.9}
          restitution={0}
          collisionGroups={WORLD_GROUPS}
        />
        <mesh geometry={terrainGeometry} position={[0, terrainY, 0]} receiveShadow>
          <meshStandardMaterial
            color={palette.ground}
            map={groundMap}
            roughness={groundRoughness}
            metalness={0}
          />
        </mesh>
      </RigidBody>

      <RoadSurface
        centerline={config.centerline}
        roadWidth={config.roadWidth}
        roadColor={palette.road}
        roadRoughness={roadRoughness}
      />

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

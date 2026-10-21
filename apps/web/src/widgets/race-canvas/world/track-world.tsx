import { useEffect, useMemo } from 'react';
import {
  CuboidCollider,
  HeightfieldCollider,
  RigidBody,
  TrimeshCollider,
} from '@react-three/rapier';
import { DoubleSide, MeshStandardMaterial } from 'three';
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
import { getSharedConcreteTexture } from '@/widgets/race-canvas/lib/concrete-texture';
import { buildRoadRibbonGeometry } from '@/widgets/race-canvas/lib/road-ribbon-geometry';
import {
  buildTerrainGeometry,
  buildTerrainHeightfieldArgs,
} from '@/widgets/race-canvas/lib/terrain-geometry';
import { TRACK_TERRAIN, terrainSeedForSlug } from '@/widgets/race-canvas/lib/terrain-height';
import { TrackObstacles } from './track-obstacles';

/**
 * Invisible wall-collider extension above the visible fence (0.85 m).
 * Car capsule center ≈ 0.9 m — without the extension the solver rolls the capsule onto the
 * low wall and the car flies over the fence in a corner.
 */
const WALL_COLLIDER_EXTENSION = 1.5;

type TTrackWorldProps = {
  /** Track config: walls, obstacles, centerline */
  config: TTrackConfig;
  /** Restart counter — recreates dynamic tires */
  resetNonce: number;
};

type TRoadSurfaceProps = {
  centerline: TTrackConfig['centerline'];
  roadWidth: number;
  roadColor: string;
  roadRoughness: number;
  roadMetalness: number;
};

/** Continuous asphalt along the centerline — no z-fighting at segment joints */
const RoadSurface = ({
  centerline,
  roadWidth,
  roadColor,
  roadRoughness,
  roadMetalness,
}: TRoadSurfaceProps) => {
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

  // Disposes geometry and texture clones on unmount.
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
        metalness={roadMetalness}
      />
    </mesh>
  );
};

/** Road Trimesh collider: follows centerline Y (climbs, bridge) */
const RoadColliders = ({
  centerline,
  roadWidth,
}: {
  centerline: TTrackConfig['centerline'];
  roadWidth: number;
}) => {
  const ribbon = useMemo(
    () => buildRoadRibbonGeometry(centerline, roadWidth),
    [centerline, roadWidth],
  );

  const args = useMemo(() => {
    const pos = ribbon.geometry.attributes.position?.array as Float32Array | undefined;
    const idx = ribbon.geometry.index?.array as Uint32Array | undefined;
    if (!pos || !idx || pos.length === 0 || idx.length === 0) {
      return null;
    }
    return [pos, idx] as const;
  }, [ribbon]);

  useEffect(() => () => ribbon.geometry.dispose(), [ribbon]);

  if (args === null) {
    return null;
  }

  const [verts, indices] = args;

  return (
    <RigidBody type="fixed" colliders={false} collisionGroups={WORLD_GROUPS}>
      <TrimeshCollider args={[verts, indices]} friction={1} restitution={0} />
    </RigidBody>
  );
};

/** Road (visuals), unified ground, and low-friction walls */
export const TrackWorld = ({ config, resetNonce }: TTrackWorldProps) => {
  const { palette } = config;
  const isNight = config.timeOfDay === 'night';
  const isRain = config.weather === 'rain';
  /** Wet asphalt at night/rain: lower roughness, higher metalness — catches headlights and lamps */
  const roadRoughness = isRain ? 0.32 : isNight ? 0.78 : 0.74;
  const roadMetalness = isRain ? 0.42 : isNight ? 0.28 : 0.04;
  const groundRoughness = isNight ? 0.88 : isRain ? 0.72 : 0.95;
  const wallEmissiveIntensity = isNight ? 0 : 0.15;
  const wallRoughness = isNight ? 0.92 : isRain ? 0.7 : 0.88;
  const terrainSeed = terrainSeedForSlug(config.slug);
  const groundWorldSize = TRACK_TERRAIN.worldSize;
  const terrainY = TRACK_TERRAIN.yOffset;

  const groundSource = useMemo(() => createGroundTexture(512), []);

  const groundMap = useMemo(
    () => cloneMapForSize(groundSource, groundWorldSize, groundWorldSize, GROUND_TILE_SIZE),
    [groundSource, groundWorldSize],
  );

  const concreteMap = useMemo(() => getSharedConcreteTexture(256), []);

  const wallMaterial = useMemo(() => {
    const material = new MeshStandardMaterial({
      color: palette.wall,
      map: concreteMap,
      emissive: palette.accent,
      emissiveIntensity: wallEmissiveIntensity,
      roughness: wallRoughness,
      metalness: 0,
      shadowSide: DoubleSide,
    });
    return material;
  }, [palette.wall, palette.accent, concreteMap, wallEmissiveIntensity, wallRoughness]);

  const pierMaterial = useMemo(() => {
    const material = new MeshStandardMaterial({
      color: palette.wall,
      map: concreteMap,
      roughness: 0.95,
      metalness: 0,
      shadowSide: DoubleSide,
    });
    return material;
  }, [palette.wall, concreteMap]);

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

  // Disposes ground textures and wall materials (concrete is a singleton, not disposed).
  useEffect(
    () => () => {
      groundSource.dispose();
      groundMap.dispose();
      wallMaterial.dispose();
      pierMaterial.dispose();
      terrainGeometry.dispose();
    },
    [groundSource, groundMap, wallMaterial, pierMaterial, terrainGeometry],
  );

  return (
    <group>
      <RigidBody type="fixed" colliders={false} friction={0.9} collisionGroups={WORLD_GROUPS}>
        {/* Failsafe floor: top ≈ -0.05, below the road (road top 0.1) — catches falls */}
        <CuboidCollider
          args={[500, 0.15, 500]}
          position={[0, -0.2, 0]}
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

      <RoadColliders centerline={config.centerline} roadWidth={config.roadWidth} />

      <RoadSurface
        centerline={config.centerline}
        roadWidth={config.roadWidth}
        roadColor={palette.road}
        roadRoughness={roadRoughness}
        roadMetalness={roadMetalness}
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
          {/* Collider taller than visuals: the invisible extension stops the capsule from riding onto the wall */}
          <CuboidCollider
            args={[
              wall.size[0] / 2,
              wall.size[1] / 2 + WALL_COLLIDER_EXTENSION / 2,
              wall.size[2] / 2,
            ]}
            position={[0, WALL_COLLIDER_EXTENSION / 2, 0]}
            friction={0}
            restitution={0}
            collisionGroups={WORLD_GROUPS}
          />
          {/* receiveShadow without cast — 256 walls would flood the shadow maps */}
          <mesh
            castShadow={false}
            receiveShadow
            position={[0, -0.075, 0]}
            material={wallMaterial}
            dispose={null}
          >
            <boxGeometry args={[wall.size[0], wall.size[1] + 0.15, wall.size[2]]} />
          </mesh>
        </RigidBody>
      ))}

      {config.piers?.map((pier, index) => (
        <RigidBody
          key={`pier-${index}`}
          type="fixed"
          colliders={false}
          position={pier.position}
          rotation={[0, pier.rotationY, 0]}
          restitution={0}
          friction={0.6}
          collisionGroups={WORLD_GROUPS}
        >
          <CuboidCollider
            args={[pier.size[0] / 2, pier.size[1] / 2, pier.size[2] / 2]}
            friction={0.6}
            restitution={0}
            collisionGroups={WORLD_GROUPS}
          />
          <mesh castShadow receiveShadow material={pierMaterial} dispose={null}>
            <boxGeometry args={[pier.size[0], pier.size[1], pier.size[2]]} />
          </mesh>
        </RigidBody>
      ))}

      <TrackObstacles obstacles={config.obstacles} resetNonce={resetNonce} />
    </group>
  );
};

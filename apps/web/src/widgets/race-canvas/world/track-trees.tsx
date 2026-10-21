import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  Color,
  Matrix4,
  Quaternion,
  Vector3,
  type CanvasTexture,
  type InstancedMesh,
  type MeshStandardMaterial,
} from 'three';
import { type TPlacedTree, type TTrackConfig } from '@/entities/track';
import { treePalette, type TTreeTimeOfDayColors } from '@/shared/config';
import { getSharedBarkTexture } from '@/widgets/race-canvas/lib/bark-texture';
import {
  getSharedBroadleafFoliageTexture,
  getSharedPineFoliageTexture,
} from '@/widgets/race-canvas/lib/foliage-texture';
import { placeTrackTreesWithGround } from '@/widgets/race-canvas/lib/place-track-trees-with-ground';
import {
  BROADLEAF_CROWN_LOCAL_Y,
  BROADLEAF_CROWN_RADIUS,
  BROADLEAF_LOBES,
  CROWN_HEIGHT_SEGMENTS,
  CROWN_RADIAL_SEGMENTS,
  PINE_CROWN_HEIGHT,
  PINE_CROWN_LOCAL_Y,
  PINE_CROWN_RADIUS,
  PINE_TIERS,
  TRUNK_HEIGHT,
  TRUNK_KIND_SCALE,
  TRUNK_LOCAL_Y,
  TRUNK_RADIUS,
  TRUNK_RADIUS_BOTTOM,
  TRUNK_SEGMENTS,
} from '@/widgets/race-canvas/lib/tree-geometry';

export {
  BROADLEAF_CROWN_LOCAL_Y,
  BROADLEAF_CROWN_RADIUS,
  PINE_CROWN_HEIGHT,
  PINE_CROWN_LOCAL_Y,
  PINE_CROWN_RADIUS,
  TRUNK_HEIGHT,
  TRUNK_LOCAL_Y,
  TRUNK_RADIUS,
  TRUNK_RADIUS_BOTTOM,
};

type TTrackTreesProps = {
  /** Track config for tree placement */
  config: TTrackConfig;
};

const Y_AXIS = new Vector3(0, 1, 0);
const tmpPos = new Vector3();
const tmpScale = new Vector3();
const tmpQuat = new Quaternion();
const tmpMatrix = new Matrix4();
const tmpColor = new Color();

/** Deterministic 0..1 from world coordinates */
const hash01 = (x: number, z: number): number => {
  let n = Math.imul(Math.floor(x * 12.9898 + z * 78.233) | 0, 1597334677);
  n = (n ^ (n >>> 16)) >>> 0;
  return n / 4294967296;
};

/** Slight crown hue variation driven by position */
const foliageInstanceColor = (tree: TPlacedTree, baseHex: string): Color => {
  const t = hash01(tree.x, tree.z);
  tmpColor.set(baseHex);
  const lum = 0.88 + t * 0.22;
  tmpColor.r = Math.min(1, tmpColor.r * lum);
  tmpColor.g = Math.min(1, tmpColor.g * (0.92 + t * 0.16));
  tmpColor.b = Math.min(1, tmpColor.b * (0.9 + (1 - t) * 0.12));
  return tmpColor;
};

/** Writes instanceColor for the crown */
const applyFoliageColors = (mesh: InstancedMesh, trees: TPlacedTree[], baseHex: string): void => {
  for (let i = 0; i < trees.length; i += 1) {
    mesh.setColorAt(i, foliageInstanceColor(trees[i]!, baseHex));
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  const material = mesh.material as MeshStandardMaterial;
  material.needsUpdate = true;
};

type TTrunkLayerProps = {
  trees: TPlacedTree[];
  color: string;
  map: CanvasTexture;
};

/** Instanced trunks with bark; scale depends on kind */
const TrunkLayer = ({ trees, color, map }: TTrunkLayerProps) => {
  const meshRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }
    if (trees.length === 0) {
      mesh.count = 0;
      return;
    }
    for (let i = 0; i < trees.length; i += 1) {
      const tree = trees[i]!;
      const kindScale = TRUNK_KIND_SCALE[tree.kind];
      tmpPos.set(tree.x, tree.groundY + TRUNK_LOCAL_Y * tree.scale * kindScale.y, tree.z);
      tmpQuat.setFromAxisAngle(Y_AXIS, tree.rotationY);
      tmpScale.set(tree.scale * kindScale.xz, tree.scale * kindScale.y, tree.scale * kindScale.xz);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(i, tmpMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = trees.length;
  }, [trees]);

  if (trees.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, trees.length]}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[TRUNK_RADIUS, TRUNK_RADIUS_BOTTOM, TRUNK_HEIGHT, TRUNK_SEGMENTS]} />
      <meshStandardMaterial color={color} map={map} roughness={0.94} metalness={0} />
    </instancedMesh>
  );
};

type TPineTierLayerProps = {
  trees: TPlacedTree[];
  color: string;
  map: CanvasTexture;
  radius: number;
  height: number;
  localY: number;
  castShadow: boolean;
};

/** One pine cone tier */
const PineTierLayer = ({
  trees,
  color,
  map,
  radius,
  height,
  localY,
  castShadow,
}: TPineTierLayerProps) => {
  const meshRef = useRef<InstancedMesh>(null);
  const pines = useMemo(() => trees.filter((tree) => tree.kind === 'pine'), [trees]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }
    if (pines.length === 0) {
      mesh.count = 0;
      return;
    }
    for (let i = 0; i < pines.length; i += 1) {
      const tree = pines[i]!;
      tmpPos.set(tree.x, tree.groundY + localY * tree.scale, tree.z);
      tmpQuat.setFromAxisAngle(Y_AXIS, tree.rotationY);
      tmpScale.set(tree.scale, tree.scale, tree.scale);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(i, tmpMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = pines.length;
    applyFoliageColors(mesh, pines, color);
  }, [pines, localY, color]);

  if (pines.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, pines.length]}
      castShadow={castShadow}
      receiveShadow
    >
      <coneGeometry args={[radius, height, CROWN_RADIAL_SEGMENTS]} />
      <meshStandardMaterial color={color} map={map} roughness={0.9} metalness={0} />
    </instancedMesh>
  );
};

type TBroadleafLobeLayerProps = {
  trees: TPlacedTree[];
  color: string;
  map: CanvasTexture;
  radius: number;
  offset: readonly [number, number, number];
  lobeScale: readonly [number, number, number];
  castShadow: boolean;
};

/** One broadleaf crown lobe */
const BroadleafLobeLayer = ({
  trees,
  color,
  map,
  radius,
  offset,
  lobeScale,
  castShadow,
}: TBroadleafLobeLayerProps) => {
  const meshRef = useRef<InstancedMesh>(null);
  const leaves = useMemo(() => trees.filter((tree) => tree.kind === 'broadleaf'), [trees]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }
    if (leaves.length === 0) {
      mesh.count = 0;
      return;
    }
    const [ox, oy, oz] = offset;
    const [sx, sy, sz] = lobeScale;
    for (let i = 0; i < leaves.length; i += 1) {
      const tree = leaves[i]!;
      const cos = Math.cos(tree.rotationY);
      const sin = Math.sin(tree.rotationY);
      const lx = ox * tree.scale;
      const lz = oz * tree.scale;
      tmpPos.set(
        tree.x + lx * cos - lz * sin,
        tree.groundY + oy * tree.scale,
        tree.z + lx * sin + lz * cos,
      );
      tmpQuat.setFromAxisAngle(Y_AXIS, tree.rotationY);
      tmpScale.set(tree.scale * sx, tree.scale * sy, tree.scale * sz);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(i, tmpMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = leaves.length;
    applyFoliageColors(mesh, leaves, color);
  }, [leaves, offset, lobeScale, color]);

  if (leaves.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, leaves.length]}
      castShadow={castShadow}
      receiveShadow
    >
      <sphereGeometry args={[radius, CROWN_RADIAL_SEGMENTS, CROWN_HEIGHT_SEGMENTS]} />
      <meshStandardMaterial color={color} map={map} roughness={0.88} metalness={0} />
    </instancedMesh>
  );
};

/** Palette color by tint key */
const paletteTint = (colors: TTreeTimeOfDayColors, tint: keyof TTreeTimeOfDayColors): string =>
  colors[tint];

/** Layered procedural trees (visuals; colliders — TrackTreeColliders) */
export const TrackTrees = ({ config }: TTrackTreesProps) => {
  const trees = useMemo(() => placeTrackTreesWithGround(config), [config]);
  const isNight = config.timeOfDay === 'night';
  const colors = isNight ? treePalette.night : treePalette.day;

  const barkMap = useMemo(() => getSharedBarkTexture(256), []);
  const pineMap = useMemo(() => getSharedPineFoliageTexture(256), []);
  const broadleafMap = useMemo(() => getSharedBroadleafFoliageTexture(256), []);

  if (trees.length === 0) {
    return null;
  }

  return (
    <group>
      <TrunkLayer trees={trees} color={colors.trunk} map={barkMap} />
      {PINE_TIERS.map((tier, index) => (
        <PineTierLayer
          key={`pine-tier-${index}`}
          trees={trees}
          color={paletteTint(colors, tier.tint)}
          map={pineMap}
          radius={tier.radius}
          height={tier.height}
          localY={tier.localY}
          castShadow={tier.castShadow}
        />
      ))}
      {BROADLEAF_LOBES.map((lobe, index) => (
        <BroadleafLobeLayer
          key={`broadleaf-lobe-${index}`}
          trees={trees}
          color={paletteTint(colors, lobe.tint)}
          map={broadleafMap}
          radius={lobe.radius}
          offset={lobe.offset}
          lobeScale={lobe.scale}
          castShadow={lobe.castShadow}
        />
      ))}
    </group>
  );
};

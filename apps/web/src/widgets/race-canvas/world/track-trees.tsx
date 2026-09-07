import { useLayoutEffect, useMemo, useRef } from 'react';
import { Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';
import {
  placeTrackTrees,
  type TPlacedTree,
  type TTrackConfig,
  type TTreeKind,
} from '@/entities/track';
import { treePalette } from '@/shared/config';

type TTrackTreesProps = {
  /** Конфиг трассы для расстановки деревьев */
  config: TTrackConfig;
};

const Y_AXIS = new Vector3(0, 1, 0);
const tmpPos = new Vector3();
const tmpScale = new Vector3();
const tmpQuat = new Quaternion();
const tmpMatrix = new Matrix4();

type TTreePartProps = {
  /** Размещённые деревья */
  trees: TPlacedTree[];
  /** Слой: ствол или вид кроны */
  kind: TTreeKind | 'trunk';
  /** Цвет материала */
  color: string;
  /** Кастить тени */
  castShadow: boolean;
  /** Тип геометрии инстанса */
  geometry: 'cylinder' | 'cone' | 'sphere';
  /** Смещение по Y в локальных единицах до scale */
  localY: number;
  /** Аргументы геометрии Three.js */
  args: number[];
};

/** Один instanced-слой (ствол / крона) */
const TreePart = ({ trees, kind, color, castShadow, geometry, localY, args }: TTreePartProps) => {
  const meshRef = useRef<InstancedMesh>(null);
  const filtered = useMemo(
    () => (kind === 'trunk' ? trees : trees.filter((tree) => tree.kind === kind)),
    [trees, kind],
  );

  // Заполняет instanceMatrix для стволов/крон.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }
    if (filtered.length === 0) {
      mesh.count = 0;
      return;
    }
    for (let i = 0; i < filtered.length; i += 1) {
      const tree = filtered[i]!;
      tmpPos.set(tree.x, localY * tree.scale, tree.z);
      tmpQuat.setFromAxisAngle(Y_AXIS, tree.rotationY);
      tmpScale.set(tree.scale, tree.scale, tree.scale);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(i, tmpMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = filtered.length;
  }, [filtered, localY]);

  if (filtered.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, filtered.length]}
      castShadow={castShadow}
    >
      {geometry === 'cylinder' ? (
        <cylinderGeometry args={args as [number, number, number, number]} />
      ) : null}
      {geometry === 'cone' ? <coneGeometry args={args as [number, number, number]} /> : null}
      {geometry === 'sphere' ? <sphereGeometry args={args as [number, number, number]} /> : null}
      <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
    </instancedMesh>
  );
};

/** Низкополигональные деревья вокруг трассы (без физики) */
export const TrackTrees = ({ config }: TTrackTreesProps) => {
  const trees = useMemo(() => placeTrackTrees({ config }), [config]);
  const isNight = config.timeOfDay === 'night';
  const castShadow = !isNight;

  const trunkColor = isNight ? treePalette.night.trunk : treePalette.day.trunk;
  const pineColor = isNight ? treePalette.night.pine : treePalette.day.pine;
  const broadleafColor = isNight ? treePalette.night.broadleaf : treePalette.day.broadleaf;

  if (trees.length === 0) {
    return null;
  }

  return (
    <group>
      <TreePart
        trees={trees}
        kind="trunk"
        color={trunkColor}
        castShadow={false}
        geometry="cylinder"
        localY={1.1}
        args={[0.22, 0.28, 2.2, 6]}
      />
      <TreePart
        trees={trees}
        kind="pine"
        color={pineColor}
        castShadow={castShadow}
        geometry="cone"
        localY={3.4}
        args={[1.35, 3.6, 7]}
      />
      <TreePart
        trees={trees}
        kind="broadleaf"
        color={broadleafColor}
        castShadow={castShadow}
        geometry="sphere"
        localY={3.2}
        args={[1.55, 7, 6]}
      />
    </group>
  );
};

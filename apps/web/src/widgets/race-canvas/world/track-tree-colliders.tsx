import { useMemo } from 'react';
import { BallCollider, ConeCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { type TPlacedTree, type TTrackConfig } from '@/entities/track';
import { WORLD_GROUPS } from '@/widgets/race-canvas/lib/collision-groups';
import { placeTrackTreesWithGround } from '@/widgets/race-canvas/lib/place-track-trees-with-ground';
import {
  BROADLEAF_CROWN_LOCAL_Y,
  BROADLEAF_CROWN_RADIUS,
  PINE_CROWN_HEIGHT,
  PINE_CROWN_LOCAL_Y,
  PINE_CROWN_RADIUS,
  TRUNK_HEIGHT,
  TRUNK_KIND_SCALE,
  TRUNK_LOCAL_Y,
  TRUNK_RADIUS,
} from '@/widgets/race-canvas/lib/tree-geometry';

type TTrackTreeCollidersProps = {
  /** Конфиг трассы — тот же список деревьев, что у визуала */
  config: TTrackConfig;
};

type TTreeColliderProps = {
  /** Размещенное дерево */
  tree: TPlacedTree;
  /** Индекс для ключа */
  index: number;
};

/** Fixed-тело одного дерева: ствол + аппроксимация кроны */
const TreeCollider = ({ tree, index }: TTreeColliderProps) => {
  const { x, z, groundY, scale, kind } = tree;
  const kindScale = TRUNK_KIND_SCALE[kind];
  const trunkHalfHeight = (TRUNK_HEIGHT / 2) * scale * kindScale.y;
  const trunkRadius = TRUNK_RADIUS * scale * kindScale.xz;

  return (
    <RigidBody
      name={`tree-${index}`}
      type="fixed"
      colliders={false}
      position={[x, groundY, z]}
      restitution={0}
      friction={0.4}
      collisionGroups={WORLD_GROUPS}
    >
      <CylinderCollider
        args={[trunkHalfHeight, trunkRadius]}
        position={[0, TRUNK_LOCAL_Y * scale * kindScale.y, 0]}
        friction={0.4}
        restitution={0}
        collisionGroups={WORLD_GROUPS}
      />
      {kind === 'pine' ? (
        <ConeCollider
          args={[(PINE_CROWN_HEIGHT / 2) * scale, PINE_CROWN_RADIUS * scale]}
          position={[0, PINE_CROWN_LOCAL_Y * scale, 0]}
          friction={0.4}
          restitution={0}
          collisionGroups={WORLD_GROUPS}
        />
      ) : (
        <BallCollider
          args={[BROADLEAF_CROWN_RADIUS * scale]}
          position={[0, BROADLEAF_CROWN_LOCAL_Y * scale, 0]}
          friction={0.4}
          restitution={0}
          collisionGroups={WORLD_GROUPS}
        />
      )}
    </RigidBody>
  );
};

/** Fixed-коллайдеры деревьев внутри Physics (ствол + крона). Визуал остается в TrackTrees вне Physics. */
export const TrackTreeColliders = ({ config }: TTrackTreeCollidersProps) => {
  const trees = useMemo(() => placeTrackTreesWithGround(config), [config]);

  if (trees.length === 0) {
    return null;
  }

  return (
    <group>
      {trees.map((tree, index) => (
        <TreeCollider key={`tree-collider-${index}`} tree={tree} index={index} />
      ))}
    </group>
  );
};

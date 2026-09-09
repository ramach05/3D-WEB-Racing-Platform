import { useMemo } from 'react';
import { BallCollider, ConeCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { placeTrackTrees, type TPlacedTree, type TTrackConfig } from '@/entities/track';
import { WORLD_GROUPS } from '@/widgets/race-canvas/lib/collision-groups';
import {
  BROADLEAF_CROWN_LOCAL_Y,
  BROADLEAF_CROWN_RADIUS,
  PINE_CROWN_HEIGHT,
  PINE_CROWN_LOCAL_Y,
  PINE_CROWN_RADIUS,
  TRUNK_HEIGHT,
  TRUNK_LOCAL_Y,
  TRUNK_RADIUS,
} from '@/widgets/race-canvas/world/track-trees';

type TTrackTreeCollidersProps = {
  /** Конфиг трассы — тот же список деревьев, что у визуала */
  config: TTrackConfig;
};

type TTreeColliderProps = {
  /** Размещённое дерево */
  tree: TPlacedTree;
  /** Индекс для ключа */
  index: number;
};

/** Fixed-тело одного дерева: ствол + крона */
const TreeCollider = ({ tree, index }: TTreeColliderProps) => {
  const { x, z, scale, kind } = tree;
  const trunkHalfHeight = (TRUNK_HEIGHT / 2) * scale;
  const trunkRadius = TRUNK_RADIUS * scale;

  return (
    <RigidBody
      name={`tree-${index}`}
      type="fixed"
      colliders={false}
      position={[x, 0, z]}
      restitution={0}
      friction={0.4}
      collisionGroups={WORLD_GROUPS}
    >
      <CylinderCollider
        args={[trunkHalfHeight, trunkRadius]}
        position={[0, TRUNK_LOCAL_Y * scale, 0]}
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

/**
 * Fixed-коллайдеры деревьев внутри Physics (ствол + крона).
 * Визуал остаётся в TrackTrees вне Physics.
 */
export const TrackTreeColliders = ({ config }: TTrackTreeCollidersProps) => {
  const trees = useMemo(() => placeTrackTrees({ config }), [config]);

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

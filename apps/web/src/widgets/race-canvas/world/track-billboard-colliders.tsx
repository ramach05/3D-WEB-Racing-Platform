import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { placeBillboards, type TPlacedBillboard, type TTrackConfig } from '@/entities/track';
import { WORLD_GROUPS } from '@/widgets/race-canvas/lib/collision-groups';
import {
  BILLBOARD_COLLIDER,
  BILLBOARD_PANEL_CENTER_Y,
  BILLBOARD_PANEL_FORWARD_X,
  BILLBOARD_POST_HALF_SPAN,
  BILLBOARD_POST_HEIGHT,
} from '@/widgets/race-canvas/lib/billboard';

type TTrackBillboardCollidersProps = {
  /** Конфиг трассы — тот же список щитов, что у визуала */
  config: TTrackConfig;
};

type TBillboardColliderProps = {
  /** Размещенный щит */
  billboard: TPlacedBillboard;
  /** Индекс для ключа */
  index: number;
};

const FRICTION = 0.4;

/** Fixed-тело одного щита: два столба + панель */
const BillboardCollider = ({ billboard, index }: TBillboardColliderProps) => {
  const postCenterY = BILLBOARD_POST_HEIGHT / 2;

  return (
    <RigidBody
      name={`billboard-${index}`}
      type="fixed"
      colliders={false}
      position={[billboard.x, 0, billboard.z]}
      rotation={[0, billboard.rotationY, 0]}
      restitution={0}
      friction={FRICTION}
      collisionGroups={WORLD_GROUPS}
    >
      <CuboidCollider
        args={[
          BILLBOARD_COLLIDER.post.halfWidth,
          BILLBOARD_COLLIDER.post.halfHeight,
          BILLBOARD_COLLIDER.post.halfDepth,
        ]}
        position={[0, postCenterY, -BILLBOARD_POST_HALF_SPAN]}
        friction={FRICTION}
        restitution={0}
        collisionGroups={WORLD_GROUPS}
      />
      <CuboidCollider
        args={[
          BILLBOARD_COLLIDER.post.halfWidth,
          BILLBOARD_COLLIDER.post.halfHeight,
          BILLBOARD_COLLIDER.post.halfDepth,
        ]}
        position={[0, postCenterY, BILLBOARD_POST_HALF_SPAN]}
        friction={FRICTION}
        restitution={0}
        collisionGroups={WORLD_GROUPS}
      />
      <CuboidCollider
        args={[
          BILLBOARD_COLLIDER.panel.halfWidth,
          BILLBOARD_COLLIDER.panel.halfHeight,
          BILLBOARD_COLLIDER.panel.halfDepth,
        ]}
        position={[BILLBOARD_PANEL_FORWARD_X, BILLBOARD_PANEL_CENTER_Y, 0]}
        friction={FRICTION}
        restitution={0}
        collisionGroups={WORLD_GROUPS}
      />
    </RigidBody>
  );
};

/** Fixed-коллайдеры рекламных щитов внутри Physics. Визуал остается в TrackBillboards вне Physics. */
export const TrackBillboardColliders = ({ config }: TTrackBillboardCollidersProps) => {
  const billboards = useMemo(() => placeBillboards({ config }), [config]);

  if (billboards.length === 0) {
    return null;
  }

  return (
    <group>
      {billboards.map((billboard, index) => (
        <BillboardCollider
          key={`billboard-collider-${index}`}
          billboard={billboard}
          index={index}
        />
      ))}
    </group>
  );
};

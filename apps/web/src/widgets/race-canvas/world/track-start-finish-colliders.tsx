import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { TOrientedBox } from '@/entities/track';
import {
  GANTRY_BEAM_CLEARANCE_Y,
  GANTRY_BEAM_DEPTH,
  GANTRY_BEAM_HEIGHT,
  GANTRY_PANEL_DEPTH,
  GANTRY_PANEL_HEIGHT,
  GANTRY_PANEL_WIDTH,
  GANTRY_POST_DEPTH,
  GANTRY_POST_OUTSET,
  GANTRY_POST_WIDTH,
  GANTRY_ROAD_TOP_Y,
} from '@/widgets/race-canvas/lib/start-light-gantry';
import { WORLD_GROUPS } from '@/widgets/race-canvas/lib/collision-groups';

type TTrackStartFinishCollidersProps = {
  /** Ориентированный бокс линии старт/финиш */
  line: TOrientedBox;
  /** Ширина дороги */
  roadWidth: number;
};

const FRICTION = 0.4;

/** Fixed-коллайдеры F1-gantry внутри Physics (столбы, балка, панель ламп). Визуал остается в TrackStartFinishLine вне Physics. */
export const TrackStartFinishColliders = ({ line, roadWidth }: TTrackStartFinishCollidersProps) => {
  const postX = roadWidth / 2 + GANTRY_POST_OUTSET;
  const spanWidth = postX * 2 + GANTRY_POST_WIDTH;
  const postHeight = GANTRY_BEAM_CLEARANCE_Y + GANTRY_BEAM_HEIGHT / 2;
  const beamY = GANTRY_ROAD_TOP_Y + GANTRY_BEAM_CLEARANCE_Y;
  const panelY = beamY + GANTRY_BEAM_HEIGHT / 2 + GANTRY_PANEL_HEIGHT / 2 + 0.02;

  return (
    <group position={[line.position[0], 0, line.position[2]]} rotation={[0, line.rotationY, 0]}>
      <RigidBody
        name="start-finish-gantry"
        type="fixed"
        colliders={false}
        restitution={0}
        friction={FRICTION}
        collisionGroups={WORLD_GROUPS}
      >
        <CuboidCollider
          args={[GANTRY_POST_WIDTH / 2, postHeight / 2, GANTRY_POST_DEPTH / 2]}
          position={[-postX, GANTRY_ROAD_TOP_Y + postHeight / 2, 0]}
          friction={FRICTION}
          restitution={0}
          collisionGroups={WORLD_GROUPS}
        />
        <CuboidCollider
          args={[GANTRY_POST_WIDTH / 2, postHeight / 2, GANTRY_POST_DEPTH / 2]}
          position={[postX, GANTRY_ROAD_TOP_Y + postHeight / 2, 0]}
          friction={FRICTION}
          restitution={0}
          collisionGroups={WORLD_GROUPS}
        />
        <CuboidCollider
          args={[spanWidth / 2, GANTRY_BEAM_HEIGHT / 2, GANTRY_BEAM_DEPTH / 2]}
          position={[0, beamY, 0]}
          friction={FRICTION}
          restitution={0}
          collisionGroups={WORLD_GROUPS}
        />
        <CuboidCollider
          args={[GANTRY_PANEL_WIDTH / 2, GANTRY_PANEL_HEIGHT / 2, GANTRY_PANEL_DEPTH / 2]}
          position={[0, panelY, GANTRY_BEAM_DEPTH * 0.15]}
          friction={FRICTION}
          restitution={0}
          collisionGroups={WORLD_GROUPS}
        />
      </RigidBody>
    </group>
  );
};

import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { TOrientedBox, TStartTribuneSide } from '@/entities/track';
import {
  CANOPY_POST_SIZE,
  CANOPY_THICKNESS,
  FASCIA_HEIGHT,
  FASCIA_THICKNESS,
  FOUNDATION_OVERHANG,
  FOUNDATION_THICKNESS,
  ROW_DEPTH,
  ROW_HEIGHT,
  SECTION_WIDTH,
  SECTION_Z_OFFSETS,
  TRIBUNE_MARGIN,
  TRIBUNE_ROWS,
  WALL_OFFSET,
  buildTribuneCanopyPosts,
  buildTribuneStairs,
  buildTribuneStairStringer,
  canopyCenterY,
  canopyUndersideY,
  rowTopY,
  tribuneRowCenterX,
  tribuneSideSign,
} from '@/entities/track';
import { WORLD_GROUPS } from '@/widgets/race-canvas/lib/collision-groups';

type TTrackTribuneCollidersProps = {
  /** Ориентированный бокс линии старт/финиш */
  line: TOrientedBox;
  /** Ширина дороги */
  roadWidth: number;
  /** Сторона трибуны относительно старта */
  side: TStartTribuneSide;
};

const ROAD_TOP_Y = 0.1;
const FRICTION = 0.4;
/** Зазор под навесом, чтобы кубы зрителей не пересекали крышу */
const CANOPY_CLEARANCE = 0.06;

type TTribuneSectionCollidersProps = {
  /** Z-центр секции */
  sectionZ: number;
  /** Внутренний X трибуны */
  tribuneInnerX: number;
  /** Знак стороны (−1 / +1) */
  sideSign: number;
  /** Индекс секции для имени тела */
  sectionIndex: number;
};

/** Fixed-коллайдеры открытой секции: цоколь, ступени, задние стойки, лестницы, навес */
const TribuneSectionColliders = ({
  sectionZ,
  tribuneInnerX,
  sideSign,
  sectionIndex,
}: TTribuneSectionCollidersProps) => {
  const backOuterX = tribuneInnerX + sideSign * TRIBUNE_ROWS * ROW_DEPTH;
  const platformCenterX = tribuneInnerX + (sideSign * TRIBUNE_ROWS * ROW_DEPTH) / 2;
  const platformDepth = TRIBUNE_ROWS * ROW_DEPTH + 0.35;
  const platformWidth = SECTION_WIDTH + 0.45;
  const canopyY = canopyCenterY();
  const canopyHalfH = CANOPY_THICKNESS / 2;
  const canopyUnderside = canopyUndersideY() - CANOPY_CLEARANCE;
  const canopyPosts = buildTribuneCanopyPosts(tribuneInnerX, sideSign);
  const stairSteps = buildTribuneStairs({ tribuneInnerX, sideSign, sectionIndex });
  const stairStringer = buildTribuneStairStringer({ tribuneInnerX, sideSign, sectionIndex });
  const topRowTop = rowTopY(TRIBUNE_ROWS - 1);

  return (
    <RigidBody
      name={`tribune-${sectionIndex}`}
      type="fixed"
      colliders={false}
      position={[0, ROAD_TOP_Y, sectionZ]}
      restitution={0}
      friction={FRICTION}
      collisionGroups={WORLD_GROUPS}
    >
      <CuboidCollider
        args={[
          (platformDepth + FOUNDATION_OVERHANG * 2) / 2,
          FOUNDATION_THICKNESS / 2,
          (platformWidth + FOUNDATION_OVERHANG * 2) / 2,
        ]}
        position={[platformCenterX, -FOUNDATION_THICKNESS / 2 + 0.02, 0]}
        friction={FRICTION}
        restitution={0}
        collisionGroups={WORLD_GROUPS}
      />
      <CuboidCollider
        args={[platformDepth / 2, ROW_HEIGHT / 2, platformWidth / 2]}
        position={[platformCenterX, ROW_HEIGHT / 2 - 0.02, 0]}
        friction={FRICTION}
        restitution={0}
        collisionGroups={WORLD_GROUPS}
      />
      {Array.from({ length: TRIBUNE_ROWS }, (_, row) => (
        <CuboidCollider
          key={`step-${row}`}
          args={[ROW_DEPTH / 2, ROW_HEIGHT / 2, SECTION_WIDTH / 2]}
          position={[
            tribuneRowCenterX(tribuneInnerX, sideSign, row),
            row * ROW_HEIGHT + ROW_HEIGHT / 2,
            0,
          ]}
          friction={FRICTION}
          restitution={0}
          collisionGroups={WORLD_GROUPS}
        />
      ))}
      {Array.from({ length: TRIBUNE_ROWS }, (_, row) => {
        const seatTopY = rowTopY(row);
        const crowdHeight = Math.max(0.2, canopyUnderside - seatTopY);
        return (
          <CuboidCollider
            key={`crowd-${row}`}
            args={[ROW_DEPTH / 2, crowdHeight / 2, SECTION_WIDTH / 2]}
            position={[
              tribuneRowCenterX(tribuneInnerX, sideSign, row),
              seatTopY + crowdHeight / 2,
              0,
            ]}
            friction={FRICTION}
            restitution={0}
            collisionGroups={WORLD_GROUPS}
          />
        );
      })}
      <CuboidCollider
        args={[FASCIA_THICKNESS / 2, FASCIA_HEIGHT / 2, (SECTION_WIDTH + 0.2) / 2]}
        position={[
          backOuterX + sideSign * (FASCIA_THICKNESS / 2),
          topRowTop + FASCIA_HEIGHT / 2,
          0,
        ]}
        friction={FRICTION}
        restitution={0}
        collisionGroups={WORLD_GROUPS}
      />
      {canopyPosts.map((post, i) => (
        <CuboidCollider
          key={`post-${i}`}
          args={[CANOPY_POST_SIZE / 2, post.height / 2, CANOPY_POST_SIZE / 2]}
          position={[...post.position]}
          friction={FRICTION}
          restitution={0}
          collisionGroups={WORLD_GROUPS}
        />
      ))}
      {stairSteps.map((step, i) => (
        <CuboidCollider
          key={`stair-${i}`}
          args={[step.size[0] / 2, step.size[1] / 2, step.size[2] / 2]}
          position={[...step.position]}
          friction={FRICTION}
          restitution={0}
          collisionGroups={WORLD_GROUPS}
        />
      ))}
      {stairStringer ? (
        <CuboidCollider
          args={[stairStringer.size[0] / 2, stairStringer.size[1] / 2, stairStringer.size[2] / 2]}
          position={[...stairStringer.position]}
          friction={FRICTION}
          restitution={0}
          collisionGroups={WORLD_GROUPS}
        />
      ) : null}
      <CuboidCollider
        args={[(TRIBUNE_ROWS * ROW_DEPTH + 0.7) / 2, canopyHalfH, (SECTION_WIDTH + 0.8) / 2]}
        position={[tribuneInnerX + (sideSign * (TRIBUNE_ROWS * ROW_DEPTH + 0.35)) / 2, canopyY, 0]}
        friction={FRICTION}
        restitution={0}
        collisionGroups={WORLD_GROUPS}
      />
    </RigidBody>
  );
};

/** Fixed-коллайдеры открытых трибун (цоколь, ступени, задние стойки, лестницы, навес). Визуал остается в TrackTribunes вне Physics. */
export const TrackTribuneColliders = ({ line, roadWidth, side }: TTrackTribuneCollidersProps) => {
  const sideSign = tribuneSideSign(side);
  const tribuneInnerX = sideSign * (roadWidth / 2 + WALL_OFFSET + TRIBUNE_MARGIN);

  return (
    <group position={[line.position[0], 0, line.position[2]]} rotation={[0, line.rotationY, 0]}>
      {SECTION_Z_OFFSETS.map((sectionZ, sectionIndex) => (
        <TribuneSectionColliders
          key={`tribune-collider-${sectionZ}`}
          sectionZ={sectionZ}
          tribuneInnerX={tribuneInnerX}
          sideSign={sideSign}
          sectionIndex={sectionIndex}
        />
      ))}
    </group>
  );
};

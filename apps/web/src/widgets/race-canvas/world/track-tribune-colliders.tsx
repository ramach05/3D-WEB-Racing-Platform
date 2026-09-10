import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { TOrientedBox, TStartTribuneSide } from '@/entities/track';
import {
  ROW_DEPTH,
  ROW_HEIGHT,
  SECTION_WIDTH,
  SECTION_Z_OFFSETS,
  TRIBUNE_MARGIN,
  TRIBUNE_ROWS,
  WALL_OFFSET,
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

/** X центра ряда трибуны */
const rowCenterX = (tribuneInnerX: number, sideSign: number, row: number) =>
  tribuneInnerX + sideSign * (row * ROW_DEPTH + ROW_DEPTH / 2);

/** Y верхней кромки ряда */
const rowTopY = (row: number) => (row + 1) * ROW_HEIGHT;

/** Y центра навеса (как в визуале) */
const CANOPY_CENTER_Y = rowTopY(TRIBUNE_ROWS - 1) + 1.1;
const CANOPY_HALF_H = 0.12 / 2;
const CANOPY_UNDERSIDE_Y = CANOPY_CENTER_Y - CANOPY_HALF_H - CANOPY_CLEARANCE;

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

/** Fixed-коллайдеры одной секции: платформа, ступени, зрители, задняя стенка, навес */
const TribuneSectionColliders = ({
  sectionZ,
  tribuneInnerX,
  sideSign,
  sectionIndex,
}: TTribuneSectionCollidersProps) => {
  const backOuterX = tribuneInnerX + sideSign * TRIBUNE_ROWS * ROW_DEPTH;
  const backRowX = rowCenterX(tribuneInnerX, sideSign, TRIBUNE_ROWS - 1);

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
        args={[(TRIBUNE_ROWS * ROW_DEPTH + 0.4) / 2, ROW_HEIGHT / 2, (SECTION_WIDTH + 0.6) / 2]}
        position={[
          tribuneInnerX + (sideSign * TRIBUNE_ROWS * ROW_DEPTH) / 2,
          ROW_HEIGHT / 2 - 0.02,
          0,
        ]}
        friction={FRICTION}
        restitution={0}
        collisionGroups={WORLD_GROUPS}
      />
      {Array.from({ length: TRIBUNE_ROWS }, (_, row) => (
        <CuboidCollider
          key={`step-${row}`}
          args={[ROW_DEPTH / 2, ROW_HEIGHT / 2, SECTION_WIDTH / 2]}
          position={[
            rowCenterX(tribuneInnerX, sideSign, row),
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
        const crowdHeight = Math.max(0.2, CANOPY_UNDERSIDE_Y - seatTopY);
        return (
          <CuboidCollider
            key={`crowd-${row}`}
            args={[ROW_DEPTH / 2, crowdHeight / 2, SECTION_WIDTH / 2]}
            position={[rowCenterX(tribuneInnerX, sideSign, row), seatTopY + crowdHeight / 2, 0]}
            friction={FRICTION}
            restitution={0}
            collisionGroups={WORLD_GROUPS}
          />
        );
      })}
      <CuboidCollider
        args={[0.1 / 2, 0.85 / 2, (SECTION_WIDTH + 0.3) / 2]}
        position={[backOuterX + sideSign * 0.06, rowTopY(TRIBUNE_ROWS - 1) + 0.42, 0]}
        friction={FRICTION}
        restitution={0}
        collisionGroups={WORLD_GROUPS}
      />
      <CuboidCollider
        args={[ROW_DEPTH / 2, 0.08 / 2, (SECTION_WIDTH + 0.2) / 2]}
        position={[backRowX, rowTopY(TRIBUNE_ROWS - 1) + 0.43, 0]}
        friction={FRICTION}
        restitution={0}
        collisionGroups={WORLD_GROUPS}
      />
      <CuboidCollider
        args={[(TRIBUNE_ROWS * ROW_DEPTH + 0.8) / 2, CANOPY_HALF_H, (SECTION_WIDTH + 1) / 2]}
        position={[
          tribuneInnerX + (sideSign * (TRIBUNE_ROWS * ROW_DEPTH + 0.5)) / 2,
          CANOPY_CENTER_Y,
          0,
        ]}
        friction={FRICTION}
        restitution={0}
        collisionGroups={WORLD_GROUPS}
      />
    </RigidBody>
  );
};

/**
 * Fixed-коллайдеры трибун внутри Physics (платформа, ступени, зрители, стенка, навес).
 * Визуал остаётся в TrackTribunes вне Physics.
 */
export const TrackTribuneColliders = ({ line, roadWidth, side }: TTrackTribuneCollidersProps) => {
  const sideSign = side === 'left' ? 1 : -1;
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

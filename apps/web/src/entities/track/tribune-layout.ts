import type { TOrientedBox, TStartTribuneSide, TVec3 } from './config.types';

/** Shared grandstand dimensions — visuals and tree-ban zone use the same numbers */
export const TRIBUNE_ROWS = 5;
export const ROW_HEIGHT = 0.65;
export const ROW_DEPTH = 0.75;
/** Geometry slightly wider than the pitch — continuous steps; spectators fit within sectionPitch */
export const SECTION_WIDTH = 8;
export const SECTION_PITCH = 6;
export const SECTION_Z_OFFSETS = [-SECTION_PITCH, 0, SECTION_PITCH] as const;
export const WALL_OFFSET = 0.5;
export const TRIBUNE_MARGIN = 2.5;
/** Canopy padding + plinth/stairs around the grandstand platform */
export const TREE_EXCLUSION_PADDING = 5;

/** Plinth: thickness of the slab sinking below ROAD_TOP_Y */
export const FOUNDATION_THICKNESS = 0.28;
/** Plinth overhang beyond the platform on X/Z */
export const FOUNDATION_OVERHANG = 0.25;

/** Canopy post cross-section (slim steel column) */
export const CANOPY_POST_SIZE = 0.14;
/** Rear posts per section (±Z, optionally center) */
export const CANOPY_POSTS_PER_SECTION = 3;
/** Canopy Y-center relative to the top edge of the back row */
export const CANOPY_CENTER_Y_OFFSET = 1.25;
/** Canopy slab thickness */
export const CANOPY_THICKNESS = 0.08;

/** Tube handrail height above the row surface */
export const RAIL_HEIGHT = 0.92;
/** Railing tube diameter */
export const RAIL_TUBE = 0.055;
/** Vertical railing post spacing */
export const RAIL_POST_SPACING = 1.55;
/** How deep the post is embedded in concrete */
export const RAIL_POST_EMBED = 0.08;

/** Stair flight width at the section end */
export const STAIR_WIDTH = 1.15;
/** Depth of one stair step (= row depth) */
export const STAIR_RUN = ROW_DEPTH;
/** Stair flush against the section end (no gap) */
export const STAIR_GAP = 0;
/** Low curb on the outer side of the stair (not a solid wall) */
export const STAIR_CURB_HEIGHT = 0.16;
export const STAIR_CURB_THICKNESS = 0.07;

/** Seat plank height */
export const SEAT_PLANK_HEIGHT = 0.07;
/** Seat plank depth */
export const SEAT_PLANK_DEPTH = 0.38;
/** Bench backrest height */
export const SEAT_BACK_HEIGHT = 0.32;
/** Backrest thickness */
export const SEAT_BACK_THICKNESS = 0.04;

/** Low rear panel (not a wall — fascia only) */
export const FASCIA_HEIGHT = 0.42;
export const FASCIA_THICKNESS = 0.08;

/** Y of the row top edge (locally to the group's ROAD_TOP_Y) */
export const rowTopY = (row: number) => (row + 1) * ROW_HEIGHT;

/** Y of the canopy center */
export const canopyCenterY = () => rowTopY(TRIBUNE_ROWS - 1) + CANOPY_CENTER_Y_OFFSET;

/** Canopy underside */
export const canopyUndersideY = () => canopyCenterY() - CANOPY_THICKNESS / 2;

/**
 * Side sign in the finish-line local frame. Grandstand visuals and colliders are rotated by
 * `startFinishLine.rotationY` = yaw along centerline index GROWTH, while the race runs
 * against it (race-direction.ts). So the car at the start looks toward local −Z
 * and its left side is local −X. Hence `left` → −1.
 */
export const tribuneSideSign = (side: TStartTribuneSide): number => (side === 'left' ? -1 : 1);

type TBuildTribuneExclusionOptions = {
  /** Start/finish line — orientation anchor */
  startFinishLine: TOrientedBox;
  /** Road width */
  roadWidth: number;
  /** Grandstand side relative to the direction of travel */
  side: TStartTribuneSide;
};

/** Oriented box around the spectator grandstands (start/finish world). */
export const buildTribuneTreeExclusionZone = ({
  startFinishLine,
  roadWidth,
  side,
}: TBuildTribuneExclusionOptions): TOrientedBox => {
  const sideSign = tribuneSideSign(side);
  const tribuneInnerLocalX = sideSign * (roadWidth / 2 + WALL_OFFSET + TRIBUNE_MARGIN);
  const tribuneDepth = TRIBUNE_ROWS * ROW_DEPTH;
  const centerLocalX = tribuneInnerLocalX + sideSign * (tribuneDepth / 2);
  const halfSpanZ = SECTION_PITCH + SECTION_WIDTH / 2 + STAIR_WIDTH + TREE_EXCLUSION_PADDING;
  const halfDepthX = tribuneDepth / 2 + FOUNDATION_OVERHANG + TREE_EXCLUSION_PADDING;

  const cos = Math.cos(startFinishLine.rotationY);
  const sin = Math.sin(startFinishLine.rotationY);
  const worldX = startFinishLine.position[0] + centerLocalX * cos;
  const worldZ = startFinishLine.position[2] - centerLocalX * sin;

  return {
    position: [worldX, 0, worldZ] as TVec3,
    size: [halfDepthX * 2, 8, halfSpanZ * 2] as TVec3,
    rotationY: startFinishLine.rotationY,
  };
};

/** X of a grandstand row center */
export const tribuneRowCenterX = (tribuneInnerX: number, sideSign: number, row: number) =>
  tribuneInnerX + sideSign * (row * ROW_DEPTH + ROW_DEPTH / 2);

export type TTribuneCanopyPost = {
  /** Post center [x, y, z] in the section local frame (y from ROAD_TOP_Y) */
  position: TVec3;
  /** Post height */
  height: number;
};

/** Rear steel canopy columns (±Z + center) — facade stays open. */
export const buildTribuneCanopyPosts = (
  tribuneInnerX: number,
  sideSign: number,
): TTribuneCanopyPost[] => {
  const underside = canopyUndersideY();
  const backX = tribuneInnerX + sideSign * (TRIBUNE_ROWS * ROW_DEPTH - CANOPY_POST_SIZE * 0.5);
  const zInset = SECTION_WIDTH / 2 - CANOPY_POST_SIZE * 0.5;
  const zPositions = [-zInset, 0, zInset] as const;
  const baseY = 0;
  const height = Math.max(0.5, underside - baseY);

  return zPositions.map((z) => ({
    position: [backX, baseY + height / 2, z] as TVec3,
    height,
  }));
};

export type TTribuneSeatPlank = {
  /** Plank center [x, y, z] */
  position: TVec3;
  /** Dimensions [depthX, height, widthZ] */
  size: TVec3;
};

/** Seats and backrests on each row of the section */
export const buildTribuneSeatPlanks = (
  tribuneInnerX: number,
  sideSign: number,
): { seats: TTribuneSeatPlank[]; backs: TTribuneSeatPlank[] } => {
  const seats: TTribuneSeatPlank[] = [];
  const backs: TTribuneSeatPlank[] = [];
  for (let row = 0; row < TRIBUNE_ROWS; row += 1) {
    const top = rowTopY(row);
    const centerX = tribuneRowCenterX(tribuneInnerX, sideSign, row);
    seats.push({
      position: [centerX, top + SEAT_PLANK_HEIGHT / 2, 0],
      size: [SEAT_PLANK_DEPTH, SEAT_PLANK_HEIGHT, SECTION_WIDTH - 0.35],
    });
    // Backrest at the rear edge of the row
    backs.push({
      position: [
        centerX + sideSign * (SEAT_PLANK_DEPTH / 2 - SEAT_BACK_THICKNESS / 2),
        top + SEAT_PLANK_HEIGHT + SEAT_BACK_HEIGHT / 2,
        0,
      ],
      size: [SEAT_BACK_THICKNESS, SEAT_BACK_HEIGHT, SECTION_WIDTH - 0.45],
    });
  }
  return { seats, backs };
};

export type TTribuneRailPart = {
  /** Center [x, y, z] */
  position: TVec3;
  /** Dimensions [sx, sy, sz] — unit box before scaling */
  size: TVec3;
  /** Euler XYZ (rad), defaults to 0 */
  rotation?: TVec3;
};

/** Tube railing on the back row: handrail + posts embedded in concrete. */
export const buildTribuneBackRails = (
  tribuneInnerX: number,
  sideSign: number,
): TTribuneRailPart[] => {
  const top = rowTopY(TRIBUNE_ROWS - 1);
  const railX =
    tribuneRowCenterX(tribuneInnerX, sideSign, TRIBUNE_ROWS - 1) +
    sideSign * (ROW_DEPTH / 2 - RAIL_TUBE);
  const parts: TTribuneRailPart[] = [];
  const half = SECTION_WIDTH / 2 - 0.12;
  const spanZ = half * 2;

  // Horizontal handrail and mid rail — exactly between the outermost posts
  parts.push({
    position: [railX, top + RAIL_HEIGHT, 0],
    size: [RAIL_TUBE, RAIL_TUBE, spanZ],
  });
  parts.push({
    position: [railX, top + RAIL_HEIGHT * 0.48, 0],
    size: [RAIL_TUBE * 0.85, RAIL_TUBE * 0.85, spanZ],
  });

  const count = Math.max(2, Math.round(SECTION_WIDTH / RAIL_POST_SPACING) + 1);
  const postHeight = RAIL_HEIGHT + RAIL_POST_EMBED;
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const z = -half + t * spanZ;
    parts.push({
      position: [railX, top - RAIL_POST_EMBED + postHeight / 2, z],
      size: [RAIL_TUBE, postHeight, RAIL_TUBE],
    });
  }

  return parts;
};

export type TTribuneStairStep = {
  /** Step center [x, y, z] */
  position: TVec3;
  /** Dimensions [depthX, height, widthZ] */
  size: TVec3;
};

export type TTribuneStairStringer = {
  /** Curb center */
  position: TVec3;
  /** Dimensions */
  size: TVec3;
};

type TBuildTribuneStairsOptions = {
  tribuneInnerX: number;
  sideSign: number;
  /** Section index within SECTION_Z_OFFSETS */
  sectionIndex: number;
};

/** Outer end sign (−1 / +1) or null if the section is not an edge one */
export const tribuneOuterEndSign = (sectionIndex: number): -1 | 1 | null => {
  const lastIndex = SECTION_Z_OFFSETS.length - 1;
  if (sectionIndex === 0) return -1;
  if (sectionIndex === lastIndex) return 1;
  return null;
};

/** Stairs only on outer ends of the edge sections — flush against the rows. */
export const buildTribuneStairs = ({
  tribuneInnerX,
  sideSign,
  sectionIndex,
}: TBuildTribuneStairsOptions): TTribuneStairStep[] => {
  const outerZSign = tribuneOuterEndSign(sectionIndex);
  if (outerZSign == null) return [];

  const stairLocalZ = outerZSign * (SECTION_WIDTH / 2 + STAIR_WIDTH / 2 + STAIR_GAP);
  const steps: TTribuneStairStep[] = [];

  for (let row = 0; row < TRIBUNE_ROWS; row += 1) {
    // Step from the ground up to the row surface — a monolithic block (not a "shelf in the air")
    const height = (row + 1) * ROW_HEIGHT;
    steps.push({
      position: [tribuneRowCenterX(tribuneInnerX, sideSign, row), height / 2, stairLocalZ],
      size: [STAIR_RUN, height, STAIR_WIDTH],
    });
  }

  return steps;
};

/** Low curb along the outer side of the stair (instead of a solid concrete wall). */
export const buildTribuneStairStringer = ({
  tribuneInnerX,
  sideSign,
  sectionIndex,
}: TBuildTribuneStairsOptions): TTribuneStairStringer | null => {
  const outerZSign = tribuneOuterEndSign(sectionIndex);
  if (outerZSign == null) return null;

  const stairLocalZ = outerZSign * (SECTION_WIDTH / 2 + STAIR_WIDTH / 2 + STAIR_GAP);
  const depth = TRIBUNE_ROWS * ROW_DEPTH;
  const platformCenterX = tribuneInnerX + (sideSign * depth) / 2;

  return {
    position: [
      platformCenterX,
      STAIR_CURB_HEIGHT / 2,
      stairLocalZ + outerZSign * (STAIR_WIDTH / 2 + STAIR_CURB_THICKNESS / 2),
    ],
    size: [depth + 0.05, STAIR_CURB_HEIGHT, STAIR_CURB_THICKNESS],
  };
};

/** Stair railing: posts on each step + a sloped handrail (no "stick in the air"). */
export const buildTribuneStairRails = (
  stairSteps: readonly TTribuneStairStep[],
  _tribuneInnerX: number,
  _sideSign: number,
): TTribuneRailPart[] => {
  if (stairSteps.length < 2) return [];
  const first = stairSteps[0];
  const last = stairSteps[stairSteps.length - 1];
  if (!first || !last) return [];

  const zSign = Math.sign(first.position[2]) || 1;
  const railZ = first.position[2] + zSign * (STAIR_WIDTH / 2 - RAIL_TUBE * 0.6);
  const parts: TTribuneRailPart[] = [];

  const treadTopY = (step: TTribuneStairStep) => step.position[1] + step.size[1] / 2;

  // Posts on each step, embedded in concrete
  for (const step of stairSteps) {
    const top = treadTopY(step);
    const postHeight = RAIL_HEIGHT + RAIL_POST_EMBED;
    parts.push({
      position: [step.position[0], top - RAIL_POST_EMBED + postHeight / 2, railZ],
      size: [RAIL_TUBE, postHeight, RAIL_TUBE],
    });
  }

  // Sloped handrail and mid rail between the first and last post
  const x0 = first.position[0];
  const x1 = last.position[0];
  const y0 = treadTopY(first) + RAIL_HEIGHT;
  const y1 = treadTopY(last) + RAIL_HEIGHT;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.hypot(dx, dy);
  const angleZ = Math.atan2(dy, dx);

  parts.push({
    position: [(x0 + x1) / 2, (y0 + y1) / 2, railZ],
    size: [length, RAIL_TUBE, RAIL_TUBE],
    rotation: [0, 0, angleZ],
  });

  const midY0 = treadTopY(first) + RAIL_HEIGHT * 0.48;
  const midY1 = treadTopY(last) + RAIL_HEIGHT * 0.48;
  const midDy = midY1 - midY0;
  const midLen = Math.hypot(dx, midDy);
  const midAngle = Math.atan2(midDy, dx);
  parts.push({
    position: [(x0 + x1) / 2, (midY0 + midY1) / 2, railZ],
    size: [midLen, RAIL_TUBE * 0.85, RAIL_TUBE * 0.85],
    rotation: [0, 0, midAngle],
  });

  return parts;
};

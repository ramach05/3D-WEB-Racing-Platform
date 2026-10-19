import {
  ROW_DEPTH,
  SECTION_PITCH,
  SECTION_WIDTH,
  TRIBUNE_ROWS,
  canopyUndersideY,
  rowTopY,
  tribuneRowCenterX,
} from '@/entities/track';

/** Stadium floods at the roof edges (visual always; SpotLight only at night). No shadow map; row neon is separate. */
export const TRIBUNE_FLOOD = {
  /** Housing drop from the canopy underside */
  housingDropY: 0.12,
  /** Share of grandstand depth from the inner edge */
  housingDepthFraction: 0.35,
  housing: {
    width: 0.22,
    height: 0.1,
    depth: 0.28,
  },
  bulbRadius: 0.04,
  /** Lens emissive for Bloom */
  lensEmissiveIntensity: 1.35,
} as const;

/** Two SpotLights at the ±Z roof edges, pointing down at the spectators. Budget: exactly 2 sources per grandstand, castShadow=false. */
export const TRIBUNE_EDGE_SPOT = {
  intensity: 42,
  distance: 14,
  /** Wide cone — half of the grandstand */
  angle: 0.95,
  penumbra: 0.9,
  decay: 2,
  /** |Z| from center: outer section edge with a small inset */
  zInset: 1.15,
  /** Aim Z as a fraction of edge Z (inward toward center) */
  aimZFraction: 0.32,
  /** Aim row (0-based) */
  aimRow: 2,
  /** Aim height above the row */
  aimYOffset: 0.45,
} as const;

/** ± roof edges along the hall */
export const TRIBUNE_EDGE_Z_SIGNS = [-1, 1] as const;

/** Background crowd wash: weak fill, main light comes from the edge Spot */
export const TRIBUNE_CROWD_WASH = {
  color: [1, 0.94, 0.82] as const,
  shirtAdd: 0.18,
  skinAdd: 0.1,
  shirtEmissive: 0.12,
  skinEmissive: 0.06,
  neonBounce: 0.06,
} as const;

/** Row platform depth along X */
export const tribuneDepthX = () => TRIBUNE_ROWS * ROW_DEPTH;

/** Half-span of the grandstand along Z (from center to the outer section end) */
export const tribuneHalfSpanZ = () => SECTION_PITCH + SECTION_WIDTH / 2;

/** Local X of the housing / Spot at the roof edge */
export const tribuneEdgeLightX = (tribuneInnerX: number, sideSign: number): number =>
  tribuneInnerX + sideSign * tribuneDepthX() * TRIBUNE_FLOOD.housingDepthFraction;

/** Local Y under the canopy */
export const tribuneEdgeLightY = (): number => canopyUndersideY() - TRIBUNE_FLOOD.housingDropY;

/** Local Z of the roof edge */
export const tribuneEdgeLightZ = (zSign: number): number =>
  zSign * (tribuneHalfSpanZ() - TRIBUNE_EDGE_SPOT.zInset);

/** Aim X — middle row */
export const tribuneEdgeAimX = (tribuneInnerX: number, sideSign: number): number =>
  tribuneRowCenterX(tribuneInnerX, sideSign, TRIBUNE_EDGE_SPOT.aimRow);

/** Aim Y — spectator torso */
export const tribuneEdgeAimY = (): number =>
  rowTopY(TRIBUNE_EDGE_SPOT.aimRow) + TRIBUNE_EDGE_SPOT.aimYOffset;

/** Aim Z — inward from the edge toward the hall center */
export const tribuneEdgeAimZ = (zSign: number): number =>
  tribuneEdgeLightZ(zSign) * TRIBUNE_EDGE_SPOT.aimZFraction;

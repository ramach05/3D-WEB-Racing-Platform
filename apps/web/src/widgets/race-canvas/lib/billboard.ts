/** Roadside billboard geometry — visuals and colliders derived from the same numbers */

/** Top of asphalt / ground */
export const BILLBOARD_ROAD_TOP_Y = 0.1;

/** Panel width (along the track, local Z) */
export const BILLBOARD_PANEL_WIDTH = 4.6;
/** Panel height */
export const BILLBOARD_PANEL_HEIGHT = 2.4;
/** Panel thickness (paper billboard box) */
export const BILLBOARD_PANEL_DEPTH = 0.14;

/** Frame width around the panel */
export const BILLBOARD_FRAME_THICKNESS = 0.12;
/** Frame depth (box) */
export const BILLBOARD_FRAME_DEPTH = 0.22;

/** Post cross-section [width, depth] */
export const BILLBOARD_POST = {
  width: 0.16,
  depth: 0.16,
} as const;

/** Post height from ground to frame top */
export const BILLBOARD_POST_HEIGHT =
  BILLBOARD_ROAD_TOP_Y + 1.35 + BILLBOARD_PANEL_HEIGHT + BILLBOARD_FRAME_THICKNESS * 2;

/** Y of panel bottom (above ground) */
export const BILLBOARD_PANEL_BOTTOM_Y = BILLBOARD_ROAD_TOP_Y + 1.35;

/** Y of panel center */
export const BILLBOARD_PANEL_CENTER_Y = BILLBOARD_PANEL_BOTTOM_Y + BILLBOARD_PANEL_HEIGHT / 2;

/** Half-span between post centers */
export const BILLBOARD_POST_HALF_SPAN =
  BILLBOARD_PANEL_WIDTH / 2 + BILLBOARD_FRAME_THICKNESS + BILLBOARD_POST.width * 0.15;

/** Panel offset forward (panel face, local +X) */
export const BILLBOARD_PANEL_FORWARD_X =
  BILLBOARD_POST.depth / 2 + BILLBOARD_PANEL_DEPTH / 2 + 0.02;

/** Y of frame top */
export const BILLBOARD_FRAME_TOP_Y =
  BILLBOARD_PANEL_CENTER_Y + BILLBOARD_PANEL_HEIGHT / 2 + BILLBOARD_FRAME_THICKNESS;

/**
 * Two gooseneck lamps on top: a single assembly mount → riser → arm → neck → housing.
 * Locally: +X is the face normal, Z runs along the billboard width.
 * The arm is longer so the housing sits ~0.7–0.9 m in front of the face (like track floods).
 */
export const BILLBOARD_FLOOD = {
  /** Lamp offset from center along Z (~quarter of the panel) */
  zSpan: BILLBOARD_PANEL_WIDTH * 0.28,
  /** Mounting plate on the top frame [depthX, heightY, widthZ] */
  mount: {
    depth: 0.14,
    height: 0.05,
    width: 0.14,
  },
  /** Vertical riser height above the frame */
  riserHeight: 0.18,
  /** Main arm length forward */
  armLength: 1.05,
  /** Arm pitch downward (rad) from horizontal */
  armPitch: 0.28,
  /** Short neck to the housing */
  neckLength: 0.28,
  /** Additional neck pitch downward relative to the arm */
  neckPitch: 0.72,
  /** Bracket tube radius */
  armRadius: 0.034,
  /** Flood housing [w, h, d] */
  housing: {
    width: 0.16,
    height: 0.11,
    depth: 0.2,
  },
  /** "Bulb" radius */
  bulbRadius: 0.038,
} as const;

/** Gooseneck housing position in the FloodLight root (for visuals). X — standoff in front of the face, Y — slightly above the frame. */
export const BILLBOARD_FLOOD_LIGHT_LOCAL = {
  x: 0.82,
  y: 0.06,
  z: 0,
} as const;

/** Soft face wash via RectAreaLight (no conical SpotLight "blobs"). One area-wash per billboard — like the scattered light of a flood pair at a track. */
export const BILLBOARD_FACE_WASH = {
  /** Light source standoff in front of the panel face */
  standoff: 0.9,
  width: BILLBOARD_PANEL_WIDTH * 0.9,
  height: BILLBOARD_PANEL_HEIGHT * 0.82,
  intensity: 2.8,
} as const;

/** Night City budget: RectAreaLight only on the K nearest billboards. Farther ones get a weak emissive face fallback. */
export const BILLBOARD_ACTIVE_WASH = {
  /** How many RectAreaLights to mount at once */
  count: 2,
  /** Keep the previous wash until the billboard is farther than the K-th + hysteresis (m) */
  switchHysteresis: 10,
} as const;

/** Night emissive: bulb always; face — only as fallback without an active wash. */
export const BILLBOARD_NIGHT_FACE = {
  /** Target linear face luminance in the distance: equal perceived brightness across all layouts */
  faceGlowTargetLuma: 0.14,
  /** faceGlowIntensity clamps: "paper" layouts don't become lightboxes, "ink" ones don't go black */
  faceGlowMin: 0.08,
  faceGlowMax: 2.5,
  /** Flood bulb EmissiveIntensity (bloom) */
  bulbEmissive: 1.4,
} as const;

/** Face EmissiveIntensity in the distance: normalized by average texture luminance. Without it, a constant is an equal "lightbox" for the light for-rent and "blackness" for apex-tires. */
export const faceGlowIntensity = (avgLuminance: number): number => {
  const raw = BILLBOARD_NIGHT_FACE.faceGlowTargetLuma / Math.max(avgLuminance, 1e-4);
  return Math.min(
    Math.max(raw, BILLBOARD_NIGHT_FACE.faceGlowMin),
    BILLBOARD_NIGHT_FACE.faceGlowMax,
  );
};

/**
 * Kept for test compatibility; the face is washed by BILLBOARD_FACE_WASH.
 * @deprecated
 */
export const BILLBOARD_FLOOD_SPOT = {
  intensity: 6.5,
  distance: 6.5,
  angle: 1.08,
  penumbra: 1,
  decay: 1.85,
} as const;

/** Local spill at the bulb — not used on the billboard face */
export const BILLBOARD_FLOOD_FILL = {
  intensity: 0.35,
  distance: 1.8,
  decay: 2,
} as const;

/** Collider half-extents */
export const BILLBOARD_COLLIDER = {
  post: {
    halfWidth: BILLBOARD_POST.width * 0.6,
    halfHeight: BILLBOARD_POST_HEIGHT / 2,
    halfDepth: BILLBOARD_POST.depth * 0.6,
  },
  panel: {
    halfWidth: BILLBOARD_PANEL_DEPTH * 0.9 + BILLBOARD_FRAME_DEPTH * 0.35,
    halfHeight: (BILLBOARD_PANEL_HEIGHT + BILLBOARD_FRAME_THICKNESS * 2) / 2,
    halfDepth: (BILLBOARD_PANEL_WIDTH + BILLBOARD_FRAME_THICKNESS * 2) / 2,
  },
} as const;

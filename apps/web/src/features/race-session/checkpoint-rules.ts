import type { TCheckpointLocalCoords, TOrientedBox } from '@/entities/track';
import { isInsideCheckpoint } from '@/entities/track';

type TVec2 = {
  /** World X */
  x: number;
  /** World Z */
  z: number;
};

/** Minimum lap progress fraction before the finish line counts (guards against a false start). */
export const MIN_LAP_PROGRESS = 0.85;

/** Zone around start/finish — the cooldown lifts after moving a lap fraction away from the line. */
export const START_FINISH_COOLDOWN_RATIO = 0.14;

/** Local coords of the line: lx across the track, lz along it (spawn at lz > 0). */
export const getTrackLineLocalCoords = (
  x: number,
  z: number,
  line: TOrientedBox,
): TCheckpointLocalCoords => {
  const dx = x - line.position[0];
  const dz = z - line.position[2];
  const sin = Math.sin(line.rotationY);
  const cos = Math.cos(line.rotationY);
  return {
    lx: dx * cos - dz * sin,
    lz: dx * sin + dz * cos,
  };
};

/** Point inside the finish volume in track coordinates. */
export const isInsideFinishZone = (x: number, z: number, line: TOrientedBox): boolean => {
  const { lx, lz } = getTrackLineLocalCoords(x, z, line);
  return Math.abs(lx) <= line.size[0] / 2 && Math.abs(lz) <= line.size[2] / 2;
};

/** Passing through the checkpoint zone, accounting for movement between frames. */
export const passedCheckpointZone = (
  prevX: number | null,
  prevZ: number | null,
  x: number,
  z: number,
  checkpoint: TOrientedBox,
): boolean => {
  if (isInsideCheckpoint(x, z, checkpoint)) {
    return true;
  }
  if (prevX === null || prevZ === null) {
    return false;
  }
  if (isInsideCheckpoint(prevX, prevZ, checkpoint)) {
    return true;
  }
  const steps = 12;
  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const sampleX = prevX + (x - prevX) * t;
    const sampleZ = prevZ + (z - prevZ) * t;
    if (isInsideCheckpoint(sampleX, sampleZ, checkpoint)) {
      return true;
    }
  }
  return false;
};

/** Whether segments AB and CD intersect on the XZ plane */
const segmentsIntersect = (a: TVec2, b: TVec2, c: TVec2, d: TVec2): boolean => {
  const denom = (b.x - a.x) * (d.z - c.z) - (b.z - a.z) * (d.x - c.x);
  if (Math.abs(denom) < 1e-9) {
    return false;
  }
  const t = ((c.x - a.x) * (d.z - c.z) - (c.z - a.z) * (d.x - c.x)) / denom;
  const u = ((c.x - a.x) * (b.z - a.z) - (c.z - a.z) * (b.x - a.x)) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
};

/** Intersection of the car's path with the finish line segment. */
export const crossedFinishLine = (
  prevX: number,
  prevZ: number,
  x: number,
  z: number,
  line: TOrientedBox,
): boolean => {
  const halfWidth = line.size[0] / 2;
  const acrossX = Math.cos(line.rotationY);
  const acrossZ = -Math.sin(line.rotationY);
  const cx = line.position[0];
  const cz = line.position[2];

  const lineStart = {
    x: cx - acrossX * halfWidth,
    z: cz - acrossZ * halfWidth,
  };
  const lineEnd = {
    x: cx + acrossX * halfWidth,
    z: cz + acrossZ * halfWidth,
  };

  return segmentsIntersect({ x: prevX, z: prevZ }, { x, z }, lineStart, lineEnd);
};
/** Sign flip of lz within the line width — catches a crossing the segment test sometimes misses near the road edge. */
export const crossedFinishPlane = (
  prevX: number,
  prevZ: number,
  x: number,
  z: number,
  line: TOrientedBox,
): boolean => {
  const halfWidth = line.size[0] / 2;
  const prev = getTrackLineLocalCoords(prevX, prevZ, line);
  const curr = getTrackLineLocalCoords(x, z, line);

  if (Math.abs(prev.lz) <= 1e-9 && Math.abs(prev.lx) <= halfWidth) {
    return true;
  }
  if (Math.abs(curr.lz) <= 1e-9 && Math.abs(curr.lx) <= halfWidth) {
    return true;
  }
  if (prev.lz * curr.lz > 0) {
    return false;
  }

  const denom = curr.lz - prev.lz;
  if (Math.abs(denom) < 1e-9) {
    return false;
  }
  const t = -prev.lz / denom;
  if (t < 0 || t > 1) {
    return false;
  }
  const lx = prev.lx + (curr.lx - prev.lx) * t;
  return Math.abs(lx) <= halfWidth;
};

/** Finish line crossing accounting for movement between frames. */
export const passedFinishLine = (
  prevX: number | null,
  prevZ: number | null,
  x: number,
  z: number,
  line: TOrientedBox,
): boolean => {
  if (prevX === null || prevZ === null) {
    return false;
  }
  if (crossedFinishLine(prevX, prevZ, x, z, line)) {
    return true;
  }
  if (crossedFinishPlane(prevX, prevZ, x, z, line)) {
    return true;
  }
  const steps = 12;
  let segmentStartX = prevX;
  let segmentStartZ = prevZ;
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const sampleX = prevX + (x - prevX) * t;
    const sampleZ = prevZ + (z - prevZ) * t;
    if (
      crossedFinishLine(segmentStartX, segmentStartZ, sampleX, sampleZ, line) ||
      crossedFinishPlane(segmentStartX, segmentStartZ, sampleX, sampleZ, line)
    ) {
      return true;
    }
    segmentStartX = sampleX;
    segmentStartZ = sampleZ;
  }
  return false;
};

/** Finish crossing only in the race direction: `lz + → −` (see `race-direction.ts`). Handles landing exactly on the plane (lz ≈ 0) between frames. */
export const isForwardFinishCrossing = (
  prevX: number,
  prevZ: number,
  x: number,
  z: number,
  line: TOrientedBox,
): boolean => {
  const halfWidth = line.size[0] / 2;
  const prev = getTrackLineLocalCoords(prevX, prevZ, line);
  const curr = getTrackLineLocalCoords(x, z, line);
  const prevOnPlane = Math.abs(prev.lz) <= 1e-9 && Math.abs(prev.lx) <= halfWidth;
  const currOnPlane = Math.abs(curr.lz) <= 1e-9 && Math.abs(curr.lx) <= halfWidth;

  // From the spawn side (lz > 0) onto the plane, or leaving the plane toward −lz.
  if (prev.lz > 0 && currOnPlane) {
    return true;
  }
  if (prevOnPlane && curr.lz < 0) {
    return true;
  }
  if (prev.lz <= 0 || curr.lz >= 0) {
    return false;
  }

  const denom = curr.lz - prev.lz;
  if (Math.abs(denom) < 1e-9) {
    return false;
  }
  const t = -prev.lz / denom;
  if (t < 0 || t > 1) {
    return false;
  }
  const lx = prev.lx + (curr.lx - prev.lx) * t;
  return Math.abs(lx) <= halfWidth;
};

/** Finish crossing only in the race direction, with subsampling between frames. */
export const passedFinishLineForward = (
  prevX: number | null,
  prevZ: number | null,
  x: number,
  z: number,
  line: TOrientedBox,
): boolean => {
  if (prevX === null || prevZ === null) {
    return false;
  }
  if (isForwardFinishCrossing(prevX, prevZ, x, z, line)) {
    return true;
  }
  const steps = 12;
  let segmentStartX = prevX;
  let segmentStartZ = prevZ;
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const sampleX = prevX + (x - prevX) * t;
    const sampleZ = prevZ + (z - prevZ) * t;
    if (isForwardFinishCrossing(segmentStartX, segmentStartZ, sampleX, sampleZ, line)) {
      return true;
    }
    segmentStartX = sampleX;
    segmentStartZ = sampleZ;
  }
  return false;
};

/** Whether a finish crossing may be counted as a completed lap. */
export const canRegisterLapCrossing = (
  crossed: boolean,
  inCooldown: boolean,
  progress: number,
): boolean => {
  return crossed && !inCooldown && progress >= MIN_LAP_PROGRESS;
};

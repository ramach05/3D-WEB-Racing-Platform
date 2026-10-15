import type { TTrackConfig } from '@/entities/track';

/** Ширина viewBox миникарты */
export const MINIMAP_VIEW_WIDTH = 200;

/** Высота viewBox миникарты */
export const MINIMAP_VIEW_HEIGHT = 120;

export type TMinimapProjection = {
  /** Мировые XZ → координаты viewBox SVG */
  project: (x: number, z: number) => { x: number; y: number };
  /**
   * Мировые XZ → viewBox, но точка сначала притягивается к ближайшему месту на
   * centerline. Убирает боковой сдвиг машины поперек дороги: маркер едет только
   * вдоль трассы (лонгитюда) и зависит лишь от курса, а не от полосовой позиции.
   */
  projectOnCenterline: (x: number, z: number) => { x: number; y: number };
};

/** Строит проекцию мир→viewBox по centerline и ширине дороги трассы */
export const createMinimapProjection = (config: TTrackConfig): TMinimapProjection => {
  const points = config.centerline;
  const xs = points.map((point) => point.x);
  const zs = points.map((point) => point.z);
  const padding = config.roadWidth + 8;
  const viewMinX = Math.min(...xs) - padding;
  const viewMaxX = Math.max(...xs) + padding;
  const viewMinZ = Math.min(...zs) - padding;
  const viewMaxZ = Math.max(...zs) + padding;
  const width = viewMaxX - viewMinX;
  const height = viewMaxZ - viewMinZ;

  const project = (x: number, z: number) => ({
    x: ((x - viewMinX) / width) * MINIMAP_VIEW_WIDTH,
    y: ((z - viewMinZ) / height) * MINIMAP_VIEW_HEIGHT,
  });

  const pointCount = points.length;

  // Ближайшая точка на замкнутой полилинии centerline: проекция на каждый отрезок.
  const nearestOnCenterline = (x: number, z: number): { x: number; z: number } => {
    if (pointCount < 2) {
      return { x: points[0]?.x ?? x, z: points[0]?.z ?? z };
    }
    let bestX = x;
    let bestZ = z;
    let bestDistSq = Infinity;
    for (let i = 0; i < pointCount; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % pointCount];
      if (!a || !b) {
        continue;
      }
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const segLenSq = dx * dx + dz * dz;
      const t =
        segLenSq > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / segLenSq)) : 0;
      const cx = a.x + dx * t;
      const cz = a.z + dz * t;
      const distSq = (x - cx) * (x - cx) + (z - cz) * (z - cz);
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestX = cx;
        bestZ = cz;
      }
    }
    return { x: bestX, z: bestZ };
  };

  return {
    project,
    projectOnCenterline: (x, z) => {
      const snapped = nearestOnCenterline(x, z);
      return project(snapped.x, snapped.z);
    },
  };
};

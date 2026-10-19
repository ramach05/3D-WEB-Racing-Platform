import { BufferAttribute, BufferGeometry } from 'three';
import { TRACK_SLUG_NIGHT_CITY } from '@racing/shared';
import type { TLoopPoint } from '@/entities/track';
import { TRACK_TERRAIN, sampleTerrainHeight } from './terrain-height';

export type TBuildTerrainGeometryOptions = {
  /** Centerline трассы для маски чаши */
  centerline: TLoopPoint[];
  /** Ширина дороги */
  roadWidth: number;
  /** Размер квадрата в мире (м) */
  worldSize?: number;
  /** Число сегментов по стороне */
  segments?: number;
  /** Seed шума */
  seed?: number;
};

/** Данные для Rapier HeightfieldCollider — та же сетка, что у визуала */
export type TTerrainHeightfieldArgs = [
  nrows: number,
  ncols: number,
  heights: number[],
  scale: { x: number; y: number; z: number },
];

/** Высоты в column-major порядке для HeightfieldCollider. nrows/ncols = число ячеек; длина heights = (nrows+1)*(ncols+1). */
export const buildTerrainHeightfieldArgs = ({
  centerline,
  roadWidth,
  worldSize = TRACK_TERRAIN.worldSize,
  segments = TRACK_TERRAIN.segments,
  seed = TRACK_TERRAIN.seeds[TRACK_SLUG_NIGHT_CITY],
}: TBuildTerrainGeometryOptions): TTerrainHeightfieldArgs => {
  const segs = Math.max(1, Math.floor(segments));
  const half = worldSize / 2;
  const vertsPerSide = segs + 1;
  const heights: number[] = new Array<number>(vertsPerSide * vertsPerSide);
  const heightOpts = { centerline, roadWidth, seed };

  // Column-major: столбец X, внутри строки по Z (Rapier)
  for (let ix = 0; ix < vertsPerSide; ix += 1) {
    const x = -half + (ix / segs) * worldSize;
    for (let iz = 0; iz < vertsPerSide; iz += 1) {
      const z = -half + (iz / segs) * worldSize;
      heights[iz + ix * vertsPerSide] = sampleTerrainHeight(x, z, heightOpts);
    }
  }

  return [segs, segs, heights, { x: worldSize, y: 1, z: worldSize }];
};

/** Горизонтальный heightfield в плоскости XZ: Y = sampleTerrainHeight. UV покрывают весь квадрат 0..1 для тайлинга dirt-текстуры. */
export const buildTerrainGeometry = ({
  centerline,
  roadWidth,
  worldSize = TRACK_TERRAIN.worldSize,
  segments = TRACK_TERRAIN.segments,
  seed = TRACK_TERRAIN.seeds[TRACK_SLUG_NIGHT_CITY],
}: TBuildTerrainGeometryOptions): BufferGeometry => {
  const segs = Math.max(1, Math.floor(segments));
  const half = worldSize / 2;
  const vertsPerSide = segs + 1;
  const vertexCount = vertsPerSide * vertsPerSide;

  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = new Uint32Array(segs * segs * 6);

  const heightOpts = { centerline, roadWidth, seed };

  for (let iz = 0; iz < vertsPerSide; iz += 1) {
    const v = iz / segs;
    const z = -half + v * worldSize;
    for (let ix = 0; ix < vertsPerSide; ix += 1) {
      const u = ix / segs;
      const x = -half + u * worldSize;
      const i = iz * vertsPerSide + ix;
      const y = sampleTerrainHeight(x, z, heightOpts);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      uvs[i * 2] = u;
      uvs[i * 2 + 1] = v;
    }
  }

  let idx = 0;
  for (let iz = 0; iz < segs; iz += 1) {
    for (let ix = 0; ix < segs; ix += 1) {
      const a = iz * vertsPerSide + ix;
      const b = a + 1;
      const c = a + vertsPerSide;
      const d = c + 1;
      indices[idx++] = a;
      indices[idx++] = c;
      indices[idx++] = b;
      indices[idx++] = b;
      indices[idx++] = c;
      indices[idx++] = d;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
};

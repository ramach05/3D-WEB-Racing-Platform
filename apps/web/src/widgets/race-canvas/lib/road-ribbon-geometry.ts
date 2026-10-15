import { BufferAttribute, BufferGeometry } from 'three';
import type { TLoopPoint } from '@/entities/track';

/** Верх асфальта (совпадает с прежним box height 0.2, center y=0) */
export const ROAD_TOP_Y = 0.1;

/** Толщина дорожного объёма */
export const ROAD_THICKNESS = 0.2;

export type TRoadRibbonResult = {
  /** Непрерывный меш дороги без копланарных пересечений */
  geometry: BufferGeometry;
  /** Длина centerline по петле (м) — для тайлинга текстуры */
  pathLength: number;
};

type TEdgeNormal = {
  nx: number;
  nz: number;
};

/** Нормаль влево относительно направления ребра a→b */
const edgeNormal = (ax: number, az: number, bx: number, bz: number): TEdgeNormal => {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  return { nx: -dz / len, nz: dx / len };
};

/**
 * Непрерывная лента асфальта по замкнутому centerline.
 * Одна поверхность вместо overlapping box-сегментов — без z-fighting.
 * Поддерживает per-point Y (elevated sections) и per-point roadWidth.
 */
export const buildRoadRibbonGeometry = (
  centerline: readonly TLoopPoint[],
  roadWidth: number,
  roadWidths?: readonly number[],
): TRoadRibbonResult => {
  const n = centerline.length;
  const empty = new BufferGeometry();
  if (n < 2 || roadWidth <= 0) {
    return { geometry: empty, pathLength: 0 };
  }

  const yTop = ROAD_TOP_Y;
  const yBot = ROAD_TOP_Y - ROAD_THICKNESS;

  const interpolatedWidths = roadWidths
    ? centerline.map((_, i) => {
        const frac = i / n;
        let prev: { idx: number; w: number } | null = null;
        let next: { idx: number; w: number } | null = null;
        for (let j = 0; j < roadWidths.length; j += 1) {
          const jFrac = j / roadWidths.length;
          if (jFrac <= frac) prev = { idx: j, w: roadWidths[j]! };
          else {
            next = { idx: j, w: roadWidths[j]! };
            break;
          }
        }
        if (prev && next) {
          const range = next.idx - prev.idx;
          const t = range > 0 ? (i - prev.idx) / range : 0;
          return prev.w + (next.w - prev.w) * t;
        }
        if (prev) return prev.w;
        return roadWidth;
      })
    : centerline.map(() => roadWidth);

  const stationCount = n + 1;
  const leftX = new Float64Array(stationCount);
  const leftZ = new Float64Array(stationCount);
  const rightX = new Float64Array(stationCount);
  const rightZ = new Float64Array(stationCount);
  const distances = new Float64Array(stationCount);

  let pathLength = 0;
  distances[0] = 0;

  for (let i = 0; i < n; i += 1) {
    const prev = centerline[(i - 1 + n) % n]!;
    const curr = centerline[i]!;
    const next = centerline[(i + 1) % n]!;
    const n1 = edgeNormal(prev.x, prev.z, curr.x, curr.z);
    const n2 = edgeNormal(curr.x, curr.z, next.x, next.z);
    let mx = n1.nx + n2.nx;
    let mz = n1.nz + n2.nz;
    const mLen = Math.hypot(mx, mz);
    if (mLen < 1e-6) {
      mx = n1.nx;
      mz = n1.nz;
    } else {
      mx /= mLen;
      mz /= mLen;
    }
    const cosHalf = mx * n1.nx + mz * n1.nz;
    const iw = interpolatedWidths[i]!;
    const miter = iw / 2 / Math.max(Math.abs(cosHalf), 0.2);

    leftX[i] = curr.x + mx * miter;
    leftZ[i] = curr.z + mz * miter;
    rightX[i] = curr.x - mx * miter;
    rightZ[i] = curr.z - mz * miter;

    if (i > 0) {
      const prevPoint = centerline[i - 1]!;
      pathLength += Math.hypot(curr.x - prevPoint.x, curr.z - prevPoint.z);
      distances[i] = pathLength;
    }
  }

  const first = centerline[0]!;
  const last = centerline[n - 1]!;
  pathLength += Math.hypot(first.x - last.x, first.z - last.z);
  distances[n] = pathLength;
  leftX[n] = leftX[0]!;
  leftZ[n] = leftZ[0]!;
  rightX[n] = rightX[0]!;
  rightZ[n] = rightZ[0]!;

  /** 4 вершины на станцию: topL, topR, botL, botR */
  const vertsPerStation = 4;
  const vertexCount = stationCount * vertsPerStation;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  const setVertex = (
    station: number,
    corner: number,
    x: number,
    y: number,
    z: number,
    u: number,
    v: number,
  ) => {
    const vi = station * vertsPerStation + corner;
    positions[vi * 3] = x;
    positions[vi * 3 + 1] = y;
    positions[vi * 3 + 2] = z;
    uvs[vi * 2] = u;
    uvs[vi * 2 + 1] = v;
  };

  const vScale = pathLength > 0 ? 1 / pathLength : 0;
  for (let i = 0; i < stationCount; i += 1) {
    const v = distances[i]! * vScale;
    const yOff = centerline[i] ? (centerline[i]!.y ?? 0) : 0;
    setVertex(i, 0, leftX[i]!, yTop + yOff, leftZ[i]!, 0, v);
    setVertex(i, 1, rightX[i]!, yTop + yOff, rightZ[i]!, 1, v);
    setVertex(i, 2, leftX[i]!, yBot + yOff, leftZ[i]!, 0, v);
    setVertex(i, 3, rightX[i]!, yBot + yOff, rightZ[i]!, 1, v);
  }

  /** На сегмент: top + bottom + left + right = 8 треугольников */
  const indices = new Uint32Array(n * 8 * 3);
  let indexWrite = 0;
  const pushQuad = (a: number, b: number, c: number, d: number) => {
    indices[indexWrite++] = a;
    indices[indexWrite++] = b;
    indices[indexWrite++] = c;
    indices[indexWrite++] = a;
    indices[indexWrite++] = c;
    indices[indexWrite++] = d;
  };

  for (let i = 0; i < n; i += 1) {
    const a = i * vertsPerStation;
    const b = (i + 1) * vertsPerStation;
    // top (+Y): TL0 → TL1 → TR1 → TR0
    pushQuad(a + 0, b + 0, b + 1, a + 1);
    // bottom (−Y): BL0 → BR0 → BR1 → BL1
    pushQuad(a + 2, a + 3, b + 3, b + 2);
    // left (outward): TL0 → BL0 → BL1 → TL1
    pushQuad(a + 0, a + 2, b + 2, b + 0);
    // right (outward): TR0 → TR1 → BR1 → BR0
    pushQuad(a + 1, b + 1, b + 3, a + 3);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  return { geometry, pathLength };
};

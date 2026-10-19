import { BufferAttribute, BufferGeometry } from 'three';
import type { TLoopPoint } from '@/entities/track';
import { ROAD_TOP_Y } from './road-ribbon-geometry';

/** Ширина поребрика (м) */
export const KERB_WIDTH = 0.42;
/** Верх поребрика чуть выше асфальта */
export const KERB_TOP_Y = ROAD_TOP_Y + 0.035;
/** Толщина поребрика */
export const KERB_THICKNESS = 0.05;
/** Длина одной красной/белой полосы вдоль трассы (м) */
export const KERB_STRIPE_LENGTH = 0.55;

export type TKerbRibbonResult = {
  /** Лента одного края */
  geometry: BufferGeometry;
  /** Длина centerline по петле (м) */
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

/** Узкая лента поребрика вдоль одного края асфальта. `sideSign` +1 — левый край (внешняя нормаль), −1 — правый. Поддерживает per-point Y для elevated секций. */
export const buildKerbRibbonGeometry = (
  centerline: readonly TLoopPoint[],
  roadWidth: number,
  sideSign: 1 | -1,
  kerbWidth: number = KERB_WIDTH,
): TKerbRibbonResult => {
  const n = centerline.length;
  const empty = new BufferGeometry();
  if (n < 2 || roadWidth <= 0 || kerbWidth <= 0) {
    return { geometry: empty, pathLength: 0 };
  }

  const halfW = roadWidth / 2;
  const outerLat = halfW;
  const innerLat = halfW - kerbWidth;
  const baseYTop = KERB_TOP_Y;
  const yBot = KERB_TOP_Y - KERB_THICKNESS;

  const stationCount = n + 1;
  const outerX = new Float64Array(stationCount);
  const outerZ = new Float64Array(stationCount);
  const innerX = new Float64Array(stationCount);
  const innerZ = new Float64Array(stationCount);
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
    const miterScale = 1 / Math.max(Math.abs(cosHalf), 0.2);

    outerX[i] = curr.x + mx * outerLat * miterScale * sideSign;
    outerZ[i] = curr.z + mz * outerLat * miterScale * sideSign;
    innerX[i] = curr.x + mx * innerLat * miterScale * sideSign;
    innerZ[i] = curr.z + mz * innerLat * miterScale * sideSign;

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
  outerX[n] = outerX[0]!;
  outerZ[n] = outerZ[0]!;
  innerX[n] = innerX[0]!;
  innerZ[n] = innerZ[0]!;

  /** 4 вершины на станцию: topOuter, topInner, botOuter, botInner */
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

  const vScale = pathLength > 0 ? 1 / KERB_STRIPE_LENGTH : 0;
  for (let i = 0; i < stationCount; i += 1) {
    const v = distances[i]! * vScale;
    const yOff = centerline[i] ? (centerline[i]!.y ?? 0) : 0;
    const yTop = baseYTop + yOff;
    // u: 0 у внутреннего края, 1 у внешнего
    setVertex(i, 0, outerX[i]!, yTop, outerZ[i]!, 1, v);
    setVertex(i, 1, innerX[i]!, yTop, innerZ[i]!, 0, v);
    setVertex(i, 2, outerX[i]!, yBot + yOff, outerZ[i]!, 1, v);
    setVertex(i, 3, innerX[i]!, yBot + yOff, innerZ[i]!, 0, v);
  }

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
    if (sideSign > 0) {
      // top (+Y)
      pushQuad(a + 0, b + 0, b + 1, a + 1);
      // bottom (−Y)
      pushQuad(a + 2, a + 3, b + 3, b + 2);
      // outer side
      pushQuad(a + 0, a + 2, b + 2, b + 0);
      // inner side
      pushQuad(a + 1, b + 1, b + 3, a + 3);
    } else {
      // зеркальный winding, чтобы нормали смотрели наружу объема
      pushQuad(a + 0, a + 1, b + 1, b + 0);
      pushQuad(a + 2, b + 2, b + 3, a + 3);
      pushQuad(a + 0, b + 0, b + 2, a + 2);
      pushQuad(a + 1, a + 3, b + 3, b + 1);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  return { geometry, pathLength };
};

import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';

/** Pine needle repeats on the crown */
export const PINE_FOLIAGE_WRAP = 2.8;
/** Broadleaf foliage repeats on the crown */
export const BROADLEAF_FOLIAGE_WRAP = 2.2;

type TRng = () => number;

/** LCG generator producing 0..1 from a seed */
const createRng = (seedInit: number): TRng => {
  let seed = seedInit >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
};

/** Deterministic hash of 2D coordinates into 0..1 */
const hash2 = (x: number, y: number, seed: number): number => {
  let n = (x * 374761393 + y * 668265263 + seed) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff;
};

/** Value noise 0..1 with bilinear interpolation */
const valueNoise = (x: number, y: number, seed: number): number => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
};

/** Fractional Brownian motion */
const fbm = (x: number, y: number, seed: number, octaves: number): number => {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise(x * freq, y * freq, seed + i * 1013) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return norm > 0 ? sum / norm : 0;
};

/** Writes a mid-gray pixel with a slight green bias for tinting via material.color */
const writeFoliagePixel = (
  data: Uint8ClampedArray,
  idx: number,
  tone: number,
  greenBias: number,
): void => {
  const gray = Math.max(40, Math.min(220, tone));
  data[idx] = Math.min(255, gray * (0.72 + greenBias * 0.08));
  data[idx + 1] = Math.min(255, gray * (0.95 + greenBias * 0.12));
  data[idx + 2] = Math.min(255, gray * (0.62 + greenBias * 0.05));
  data[idx + 3] = 255;
};

/** Pine needles: fine needle-like grain + dark pockets. Mid albedo — tint via material.color. */
export const createPineFoliageTexture = (size = 256): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2d canvas context unavailable');
  }

  const imageData = ctx.createImageData(size, size);
  const { data } = imageData;
  const next = createRng(0xc0e1);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;

      const needles = fbm(u * 48, v * 52, 19, 4);
      const clumps = fbm(u * 9, v * 11, 53, 3);
      const shade = valueNoise(u * 3.5, v * 4, 97);
      const grit = (next() - 0.5) * 16;

      let tone = 118 + (needles - 0.5) * 70 + (clumps - 0.5) * 36 + (shade - 0.5) * 28 + grit;
      if (clumps < 0.32) {
        tone -= (0.32 - clumps) * 90;
      }

      writeFoliagePixel(data, (y * size + x) * 4, tone, 0.35);
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 4;
  texture.repeat.set(PINE_FOLIAGE_WRAP, PINE_FOLIAGE_WRAP);
  texture.needsUpdate = true;
  return texture;
};

/** Broadleaf foliage: leaf-cluster patches. Mid albedo — tint via material.color. */
export const createBroadleafFoliageTexture = (size = 256): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2d canvas context unavailable');
  }

  const imageData = ctx.createImageData(size, size);
  const { data } = imageData;
  const next = createRng(0x1eaf);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;

      const canopy = fbm(u * 7, v * 8, 31, 4);
      const leaves = fbm(u * 28, v * 30, 67, 3);
      const vein = valueNoise(u * 55 + canopy, v * 18, 101);
      const grit = (next() - 0.5) * 12;

      let tone = 125 + (canopy - 0.5) * 48 + (leaves - 0.5) * 55 + (vein - 0.5) * 20 + grit;
      if (canopy > 0.68) {
        tone += (canopy - 0.68) * 55;
      }
      if (leaves < 0.28) {
        tone -= (0.28 - leaves) * 75;
      }

      writeFoliagePixel(data, (y * size + x) * 4, tone, 0.55);
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 4;
  texture.repeat.set(BROADLEAF_FOLIAGE_WRAP, BROADLEAF_FOLIAGE_WRAP);
  texture.needsUpdate = true;
  return texture;
};

let sharedPineFoliage: CanvasTexture | null = null;
let sharedBroadleafFoliage: CanvasTexture | null = null;

/** Shared pine needles — created once per session */
export const getSharedPineFoliageTexture = (size = 256): CanvasTexture => {
  if (!sharedPineFoliage) {
    sharedPineFoliage = createPineFoliageTexture(size);
  }
  return sharedPineFoliage;
};

/** Shared broadleaf foliage — created once per session */
export const getSharedBroadleafFoliageTexture = (size = 256): CanvasTexture => {
  if (!sharedBroadleafFoliage) {
    sharedBroadleafFoliage = createBroadleafFoliageTexture(size);
  }
  return sharedBroadleafFoliage;
};

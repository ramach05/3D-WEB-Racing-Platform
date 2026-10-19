import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';

/** World size of one concrete tile (meters) */
export const CONCRETE_TILE_SIZE = 1.4;

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

/** Fractional Brownian motion: sum of value-noise octaves */
const fbm = (x: number, y: number, seed: number, octaves: number): number => {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq, seed + i * 1013) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
};

/** Realistic concrete: large patches + fine grit. Mid-gray albedo — tint via material.color (palette.wall / tribunePalette). */
export const createConcreteTexture = (size = 256): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2d canvas context unavailable');
  }

  const imageData = ctx.createImageData(size, size);
  const { data } = imageData;
  const next = createRng(0xce7e);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;

      const macro = fbm(u * 4, v * 4, 17, 3);
      const mid = fbm(u * 22, v * 22, 53, 3);
      const fine = fbm(u * 90, v * 90, 101, 2);
      const grit = (next() - 0.5) * 18;

      let tone = 162 + (macro - 0.5) * 28 + (mid - 0.5) * 32 + (fine - 0.5) * 22 + grit;

      // Rare concrete pores / chips
      if (next() < 0.01) {
        tone -= 18 + next() * 22;
      } else if (next() < 0.008) {
        tone += 14 + next() * 18;
      }

      const gray = Math.max(95, Math.min(210, tone));
      const idx = (y * size + x) * 4;
      // Slightly warm neutral concrete
      data[idx] = Math.min(255, gray * 1.02);
      data[idx + 1] = gray;
      data[idx + 2] = gray * 0.96;
      data[idx + 3] = 255;
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
  texture.repeat.set(1 / CONCRETE_TILE_SIZE, 1 / CONCRETE_TILE_SIZE);
  texture.needsUpdate = true;
  return texture;
};

let sharedConcreteTexture: CanvasTexture | null = null;

/** One shared concrete CanvasTexture for walls + tribunes (no duplicated VRAM). Do not dispose from components — lives for the race session. */
export const getSharedConcreteTexture = (size = 256): CanvasTexture => {
  if (!sharedConcreteTexture) {
    sharedConcreteTexture = createConcreteTexture(size);
  }
  return sharedConcreteTexture;
};

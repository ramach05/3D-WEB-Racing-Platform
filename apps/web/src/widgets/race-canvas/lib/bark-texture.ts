import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';

/** Горизонтальных повторов коры вокруг ствола */
export const BARK_WRAP_U = 2.4;
/** Вертикальных повторов коры по высоте ствола */
export const BARK_WRAP_V = 3.2;

type TRng = () => number;

/** LCG-генератор 0..1 из seed */
const createRng = (seedInit: number): TRng => {
  let seed = seedInit >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
};

/** Детерминированный хэш 2D-координат в 0..1 */
const hash2 = (x: number, y: number, seed: number): number => {
  let n = (x * 374761393 + y * 668265263 + seed) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff;
};

/** Value-noise 0..1 с билинейной интерполяцией */
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

/**
 * Кора ствола: вертикальные трещины + mottling.
 * Mid-gray albedo — тинт через material.color.
 */
export const createBarkTexture = (size = 256): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2d canvas context unavailable');
  }

  const imageData = ctx.createImageData(size, size);
  const { data } = imageData;
  const next = createRng(0xb4a1);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;

      // Трещины вытянуты по высоте ствола (V)
      const rift = fbm(u * 14, v * 2.2, 17, 4);
      const plate = fbm(u * 5.5 + rift * 0.35, v * 3.5, 41, 3);
      const lichen = valueNoise(u * 22, v * 18, 83);
      const grit = (next() - 0.5) * 14;

      let tone = 128 + (plate - 0.5) * 42 + (rift - 0.5) * 55 + grit;
      // Глубокие вертикальные расщелины
      if (rift < 0.28) {
        tone -= (0.28 - rift) * 120;
      }
      // Светлые чешуйки коры
      if (plate > 0.72) {
        tone += (plate - 0.72) * 70;
      }
      // Редкий лишайник
      if (lichen > 0.88) {
        tone += 18;
      }

      const gray = Math.max(48, Math.min(210, tone));
      const idx = (y * size + x) * 4;
      data[idx] = Math.min(255, gray * 1.08);
      data[idx + 1] = Math.min(255, gray * 0.9);
      data[idx + 2] = Math.min(255, gray * 0.72);
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
  texture.repeat.set(BARK_WRAP_U, BARK_WRAP_V);
  texture.needsUpdate = true;
  return texture;
};

let sharedBarkTexture: CanvasTexture | null = null;

/**
 * Один CanvasTexture коры на сессию (без дублирования VRAM).
 * Не dispose из компонентов.
 */
export const getSharedBarkTexture = (size = 256): CanvasTexture => {
  if (!sharedBarkTexture) {
    sharedBarkTexture = createBarkTexture(size);
  }
  return sharedBarkTexture;
};

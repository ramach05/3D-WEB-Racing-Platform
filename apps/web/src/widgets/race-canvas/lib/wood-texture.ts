import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';

/** Мировой размер одного тайла древесины (метры) */
export const WOOD_TILE_SIZE = 0.9;

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

/**
 * Тёплое дерево с продольными волокнами (для скамеек трибуны).
 * albedo mid — тинт через material.color.
 */
export const createWoodTexture = (size = 256): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2d canvas context unavailable');
  }

  const imageData = ctx.createImageData(size, size);
  const { data } = imageData;
  const next = createRng(0xa0d);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;

      // Волокна вдоль U (длина скамьи)
      const grain = valueNoise(u * 2.5, v * 48, 11);
      const ring = valueNoise(u * 1.2 + grain * 0.15, v * 6, 29);
      const pore = valueNoise(u * 18, v * 90, 71);
      const grit = (next() - 0.5) * 10;

      let tone = 148 + (grain - 0.5) * 36 + (ring - 0.5) * 22 + (pore - 0.5) * 14 + grit;
      // Редкие сучки
      if (next() < 0.004) {
        tone -= 28 + next() * 20;
      }

      const gray = Math.max(70, Math.min(200, tone));
      const idx = (y * size + x) * 4;
      data[idx] = Math.min(255, gray * 1.18);
      data[idx + 1] = Math.min(255, gray * 0.92);
      data[idx + 2] = Math.min(255, gray * 0.62);
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
  texture.repeat.set(1 / WOOD_TILE_SIZE, 1 / WOOD_TILE_SIZE);
  texture.needsUpdate = true;
  return texture;
};

let sharedWoodTexture: CanvasTexture | null = null;

/**
 * Один CanvasTexture дерева на трибуны (без дублирования VRAM).
 * Не dispose из компонентов — живёт на время сессии гонки.
 */
export const getSharedWoodTexture = (size = 256): CanvasTexture => {
  if (!sharedWoodTexture) {
    sharedWoodTexture = createWoodTexture(size);
  }
  return sharedWoodTexture;
};

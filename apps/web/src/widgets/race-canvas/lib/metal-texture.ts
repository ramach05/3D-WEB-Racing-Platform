import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';

/** Мировой размер одного тайла профнастила (метры) */
export const METAL_TILE_SIZE = 1.1;

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
 * Оцинкованный профнастил для навеса трибуны: рёбра + лёгкий шум.
 * albedo mid-gray — тинт через material.color.
 */
export const createCorrugatedMetalTexture = (size = 256): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2d canvas context unavailable');
  }

  const imageData = ctx.createImageData(size, size);
  const { data } = imageData;
  const next = createRng(0x7e7a);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;

      // Гофры вдоль V (поперёк навеса)
      const ribs = 0.5 + 0.5 * Math.sin(u * Math.PI * 18);
      const micro = valueNoise(u * 40, v * 12, 41);
      const stain = valueNoise(u * 3, v * 5, 83);
      const grit = (next() - 0.5) * 8;

      let tone = 168 + (ribs - 0.5) * 48 + (micro - 0.5) * 16 + (stain - 0.5) * 12 + grit;
      // Лёгкие царапины вдоль листа
      if (next() < 0.012) {
        tone += 10 + next() * 14;
      }

      const gray = Math.max(110, Math.min(230, tone));
      const idx = (y * size + x) * 4;
      data[idx] = gray * 0.98;
      data[idx + 1] = gray;
      data[idx + 2] = Math.min(255, gray * 1.04);
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
  texture.repeat.set(1 / METAL_TILE_SIZE, 1 / METAL_TILE_SIZE);
  texture.needsUpdate = true;
  return texture;
};

let sharedMetalTexture: CanvasTexture | null = null;

/**
 * Один CanvasTexture металла на трибуны (без дублирования VRAM).
 * Не dispose из компонентов — живёт на время сессии гонки.
 */
export const getSharedCorrugatedMetalTexture = (size = 256): CanvasTexture => {
  if (!sharedMetalTexture) {
    sharedMetalTexture = createCorrugatedMetalTexture(size);
  }
  return sharedMetalTexture;
};

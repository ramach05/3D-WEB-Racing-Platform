import { CanvasTexture, LinearFilter, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

/** Мировой размер одного тайла асфальта (метры) — мельче = плотнее зерно */
export const ASPHALT_TILE_SIZE = 2.2;

/** Мировой размер тайла грунта */
export const GROUND_TILE_SIZE = 10;

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

/** Fractional Brownian motion: сумма октав value-noise */
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

/** Собирает CanvasTexture с repeat/anisotropy из canvas */
const finishTexture = (canvas: HTMLCanvasElement, colorSpace = true): CanvasTexture => {
  const texture = new CanvasTexture(canvas);
  if (colorSpace) {
    texture.colorSpace = SRGBColorSpace;
  }
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
};

/**
 * Реалистичный асфальт: многооктавный шум + мелкий гравий, без крупных кругов.
 * albedo mid-light gray — тинт через material.color (palette.road).
 */
export const createAsphaltTexture = (size = 512): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2d canvas context unavailable');
  }

  const imageData = ctx.createImageData(size, size);
  const { data } = imageData;
  const next = createRng(0xc0ffee);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;

      // Крупная неоднородность покрытия (стёртые / свежие зоны)
      const macro = fbm(u * 3.5, v * 3.5, 11, 3);
      // Средний щебень
      const mid = fbm(u * 28, v * 28, 47, 4);
      // Мелкое зерно
      const fine = fbm(u * 120, v * 120, 91, 2);
      // Пиксельный гравий
      const grit = (next() - 0.5) * 22;

      let tone = 155 + (macro - 0.5) * 32 + (mid - 0.5) * 36 + (fine - 0.5) * 28 + grit;

      // Редкие мелкие камешки (1–2 px), не пятна
      if (next() < 0.012) {
        tone += 28 + next() * 35;
      } else if (next() < 0.018) {
        tone -= 20 + next() * 25;
      }

      const gray = Math.max(90, Math.min(220, tone));
      // Нейтрально-тёплый оттенок дневного асфальта (щебень)
      const idx = (y * size + x) * 4;
      data[idx] = Math.min(255, gray * 1.0);
      data[idx + 1] = gray * 0.99;
      data[idx + 2] = gray * 0.97;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return finishTexture(canvas);
};

/** Roughness-карта асфальта: зерно + вариация блеска */
export const createAsphaltRoughnessMap = (size = 512): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2d canvas context unavailable');
  }

  const imageData = ctx.createImageData(size, size);
  const { data } = imageData;
  const next = createRng(0xbadc0de);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // Крупные пятна свежего / стёртого асфальта
      const macro = fbm(u * 4.5, v * 4.5, 117, 4);
      const n = fbm(u * 40, v * 40, 203, 3);
      const grit = next() * 0.15;
      // 0.48–0.98 в linear: выше = матовее; макро сдвигает целые зоны
      const r = Math.max(
        0,
        Math.min(255, (0.55 + macro * 0.22 + n * 0.2 + grit) * 255),
      );
      const idx = (y * size + x) * 4;
      data[idx] = r;
      data[idx + 1] = r;
      data[idx + 2] = r;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return finishTexture(canvas, false);
};

/**
 * Грунт / земля за пределами трассы: dirt noise, тинт через palette.ground.
 */
export const createGroundTexture = (size = 512): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2d canvas context unavailable');
  }

  const imageData = ctx.createImageData(size, size);
  const { data } = imageData;
  const next = createRng(0x5eed);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const clumps = fbm(u * 6, v * 6, 301, 4);
      const fine = fbm(u * 48, v * 48, 409, 3);
      const grit = (next() - 0.5) * 26;

      let tone = 152 + (clumps - 0.5) * 58 + (fine - 0.5) * 42 + grit;
      if (next() < 0.01) {
        tone += 48;
      } else if (next() < 0.014) {
        tone -= 36;
      }

      const gray = Math.max(55, Math.min(220, tone));
      const idx = (y * size + x) * 4;
      data[idx] = Math.min(255, gray * 1.12);
      data[idx + 1] = Math.min(255, gray * 0.98);
      data[idx + 2] = gray * 0.78;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return finishTexture(canvas);
};

/** Клонирует карту и выставляет repeat под мировой размер */
export const cloneMapForSize = (
  source: Texture,
  worldWidth: number,
  worldLength: number,
  tileSize: number,
): Texture => {
  const map = source.clone();
  map.wrapS = RepeatWrapping;
  map.wrapT = RepeatWrapping;
  map.repeat.set(worldWidth / tileSize, worldLength / tileSize);
  map.needsUpdate = true;
  return map;
};

/** Клон асфальта с тайлом ASPHALT_TILE_SIZE */
export const cloneAsphaltMapForSegment = (
  source: Texture,
  width: number,
  length: number,
): Texture => cloneMapForSize(source, width, length, ASPHALT_TILE_SIZE);

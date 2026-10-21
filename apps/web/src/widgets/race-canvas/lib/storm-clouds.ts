import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';

/** Value-noise lattice period along X (integer) — guarantees seamless tiling in U */
const PERIOD_X = 16;

/** Deterministic lattice hash; X is wrapped modulo PERIOD_X for seamlessness */
const hash2 = (x: number, y: number, seed: number): number => {
  const wx = ((x % PERIOD_X) + PERIOD_X) % PERIOD_X;
  let n = (wx * 374761393 + y * 668265263 + seed) | 0;
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

/** fBm: sum of octaves; X frequency is a multiple of PERIOD_X so each octave stays periodic */
const fbm = (ux: number, y: number, seed: number, octaves: number): number => {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const freqX = PERIOD_X * (1 << i);
    const freqY = 1 << i;
    sum += valueNoise(ux * freqX, y * freqY, seed + i * 1013) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
};

/**
 * Tiled storm cloud layer texture: dark slate base,
 * cloud breaks (fbm) produce bright tops and dark bellies.
 * Seamless in U; vertically — slight darkening toward the zenith for depth.
 */
export const createStormCloudTexture = (size = 512): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2d canvas context unavailable');
  }

  const imageData = ctx.createImageData(size, size);
  const { data } = imageData;

  for (let y = 0; y < size; y++) {
    const u = y / size;
    for (let x = 0; x < size; x++) {
      const v = x / size;
      const coverage = fbm(v, u * 3, 7, 5);
      const detail = fbm(v, u * 9, 91, 4);
      const mass = coverage * 0.7 + detail * 0.3;

      // Bright belly → white cloud top; a high base = rainy day, not a thunderstorm
      const shade = 135 + Math.max(0, mass - 0.4) * 210;
      // Slight blue of the storm sky + a touch of coldness at the top
      let r = shade * 0.86;
      let g = shade * 0.94;
      let b = shade * 1.06;

      // Breaks: locally a bit darker (a gap in the storm cloud)
      if (mass < 0.32) {
        const d = (0.32 - mass) * 70;
        r -= d;
        g -= d;
        b -= d;
      }

      const idx = (y * size + x) * 4;
      data[idx] = Math.max(12, Math.min(210, r));
      data[idx + 1] = Math.max(14, Math.min(220, g));
      data[idx + 2] = Math.max(20, Math.min(235, b));
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
  texture.needsUpdate = true;
  return texture;
};

let sharedStormCloudTexture: CanvasTexture | null = null;

/** One clouds CanvasTexture per race session (storm sky dome). Do not dispose from components — reused between tracks. */
export const getSharedStormCloudTexture = (size = 512): CanvasTexture => {
  if (!sharedStormCloudTexture) {
    sharedStormCloudTexture = createStormCloudTexture(size);
  }
  return sharedStormCloudTexture;
};

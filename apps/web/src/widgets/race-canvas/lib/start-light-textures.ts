import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';

/** LED matrix size inside the round lens */
const LED_GRID = 8;

type TLensTextures = {
  /** Albedo: smoked glass + visible diode grid */
  map: CanvasTexture;
  /** Emissive: disc fill + hot LED dots (otherwise only the dots would glow) */
  emissiveMap: CanvasTexture;
};

/** Writes an RGBA pixel into ImageData */
const setPixel = (
  data: Uint8ClampedArray,
  size: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void => {
  const idx = (y * size + x) * 4;
  data[idx] = r;
  data[idx + 1] = g;
  data[idx + 2] = b;
  data[idx + 3] = a;
};

/** Finalizes a CanvasTexture from a canvas (no tiling — one sprite per lens) */
const finishTexture = (canvas: HTMLCanvasElement, srgb = true): CanvasTexture => {
  const texture = new CanvasTexture(canvas);
  if (srgb) {
    texture.colorSpace = SRGBColorSpace;
  }
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
};

/** Round F1 lens: smoked glass + LED grid. emissiveMap — nearly the whole disc is bright (with LED hotspots) so the lamp reads well in daylight. */
export const createStartLightLensTextures = (size = 256): TLensTextures => {
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = size;
  mapCanvas.height = size;
  const mapCtx = mapCanvas.getContext('2d');
  if (!mapCtx) {
    throw new Error('2d canvas context unavailable');
  }

  const emisCanvas = document.createElement('canvas');
  emisCanvas.width = size;
  emisCanvas.height = size;
  const emisCtx = emisCanvas.getContext('2d');
  if (!emisCtx) {
    throw new Error('2d canvas context unavailable');
  }

  const mapData = mapCtx.createImageData(size, size);
  const emisData = emisCtx.createImageData(size, size);
  const cx = (size - 1) * 0.5;
  const cy = (size - 1) * 0.5;
  const radius = size * 0.48;
  const cell = (radius * 1.55) / LED_GRID;
  const ledR = cell * 0.32;
  const gridOrigin = cx - (LED_GRID - 1) * cell * 0.5;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      const rim = dist / radius;

      if (rim > 1) {
        setPixel(mapData.data, size, x, y, 0, 0, 0, 0);
        setPixel(emisData.data, size, x, y, 0, 0, 0, 0);
        continue;
      }

      // Albedo: smoked glass
      const rimGlow = Math.pow(Math.max(0, rim - 0.72) / 0.28, 1.4);
      const centerShade = 1 - rim * 0.25;
      let rCh = (28 + rimGlow * 45) * centerShade;
      let gCh = (14 + rimGlow * 30) * centerShade;
      let bCh = (16 + rimGlow * 34) * centerShade;

      // Emissive: solid disc fill (main glow) + LEDs
      const fill = Math.pow(1 - rim * 0.55, 1.15);
      let emis = 0.82 * fill;

      const gx = Math.round((x - gridOrigin) / cell);
      const gy = Math.round((y - gridOrigin) / cell);

      if (gx >= 0 && gx < LED_GRID && gy >= 0 && gy < LED_GRID) {
        const lx = gridOrigin + gx * cell;
        const ly = gridOrigin + gy * cell;
        const ledDist = Math.hypot(x - lx, y - ly);
        if (ledDist < ledR && Math.hypot(lx - cx, ly - cy) < radius * 0.9) {
          const t = 1 - ledDist / ledR;
          const core = Math.pow(t, 1.4);
          rCh = Math.min(255, rCh + 70 * core);
          gCh = Math.min(255, gCh + 12 * core);
          bCh = Math.min(255, bCh + 14 * core);
          emis = Math.min(1, emis + 0.45 * core);
        }
      }

      const e = Math.round(emis * 255);
      setPixel(mapData.data, size, x, y, rCh, gCh, bCh, 255);
      setPixel(emisData.data, size, x, y, e, e, e, 255);
    }
  }

  mapCtx.putImageData(mapData, 0, 0);
  emisCtx.putImageData(emisData, 0, 0);

  return {
    map: finishTexture(mapCanvas),
    emissiveMap: finishTexture(emisCanvas, false),
  };
};

/** Light matte noise for the panel (no seams/rivets — otherwise it looks like "a random texture"). */
export const createStartLightHousingTexture = (size = 128): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2d canvas context unavailable');
  }

  const imageData = ctx.createImageData(size, size);
  const { data } = imageData;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const grit = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
      const n = (grit < 0 ? grit + 1 : grit) * 8 - 4;
      const base = 18 + n;
      setPixel(
        data,
        size,
        x,
        y,
        Math.max(0, Math.min(255, base)),
        Math.max(0, Math.min(255, base + 1)),
        Math.max(0, Math.min(255, base + 2)),
      );
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return finishTexture(canvas);
};

let sharedLensTextures: TLensTextures | null = null;
let sharedHousingTexture: CanvasTexture | null = null;

/** Reset the shared cache (HMR / tests) */
export const resetStartLightTextureCache = (): void => {
  sharedLensTextures = null;
  sharedHousingTexture = null;
};

/** One lens map/emissiveMap set per session */
export const getSharedStartLightLensTextures = (size = 256): TLensTextures => {
  if (!sharedLensTextures) {
    sharedLensTextures = createStartLightLensTextures(size);
  }
  return sharedLensTextures;
};

/** One housing texture per session */
export const getSharedStartLightHousingTexture = (size = 128): CanvasTexture => {
  if (!sharedHousingTexture) {
    sharedHousingTexture = createStartLightHousingTexture(size);
  }
  return sharedHousingTexture;
};

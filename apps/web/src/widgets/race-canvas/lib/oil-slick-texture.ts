import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';

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

/** Процедурная лужа масла: темный эллипс с мягкими краями и слабым радужным бликом. ClampToEdge — один спрайт на пятно, без тайлинга. */
export const createOilSlickTexture = (size = 256): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2d canvas context unavailable');
  }

  const imageData = ctx.createImageData(size, size);
  const { data } = imageData;
  const next = createRng(0x011);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      // Эллипс с легкой деформацией края
      const edgeWobble = (valueNoise(u * 6, v * 6, 17) - 0.5) * 0.08;
      const dx = (u - 0.5) * 2;
      const dy = (v - 0.5) * 2;
      const r = Math.hypot(dx * 1.05, dy * 0.92) + edgeWobble;
      // Мягкий alpha: центр плотный, край прозрачный
      const alpha = Math.max(0, Math.min(1, (0.92 - r) / 0.28));
      if (alpha <= 0.004) {
        const idx = (y * size + x) * 4;
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
        continue;
      }

      const n1 = valueNoise(u * 4.5, v * 3.2, 41);
      const n2 = valueNoise(u * 11, v * 9, 73);
      const n3 = valueNoise(u * 22 + n1, v * 18, 101);
      const grit = (next() - 0.5) * 8;

      // База: почти черное масло с коричневым теплом
      let rCh = 18 + n1 * 22 + grit;
      let gCh = 14 + n1 * 16 + grit * 0.6;
      let bCh = 12 + n2 * 14;

      // Слабый rainbow sheen (тонкая пленка)
      const sheen = Math.pow(Math.max(0, n3 - 0.55), 1.6) * (0.35 + n2 * 0.4);
      const hue = (n1 * 0.55 + n2 * 0.45) * Math.PI * 2;
      rCh += sheen * (90 + Math.cos(hue) * 70);
      gCh += sheen * (70 + Math.cos(hue + 2.1) * 55);
      bCh += sheen * (100 + Math.cos(hue + 4.2) * 80);

      // Чуть светлее к центру блика
      const centerGlow = Math.max(0, 1 - r * 1.4) * 12;
      rCh += centerGlow;
      gCh += centerGlow * 0.85;
      bCh += centerGlow * 0.7;

      const idx = (y * size + x) * 4;
      data[idx] = Math.max(0, Math.min(255, rCh));
      data[idx + 1] = Math.max(0, Math.min(255, gCh));
      data[idx + 2] = Math.max(0, Math.min(255, bCh));
      data[idx + 3] = Math.max(0, Math.min(255, alpha * 230));
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
};

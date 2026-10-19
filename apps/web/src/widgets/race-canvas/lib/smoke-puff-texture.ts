import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';

/** Resolution of the soft-puff smoke texture (power of two) */
const SMOKE_PUFF_SIZE = 64;

/** Creates a soft radial smoke texture (white RGB + soft alpha). One shared texture for the whole InstancedMesh. */
export const createSmokePuffTexture = (): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = SMOKE_PUFF_SIZE;
  canvas.height = SMOKE_PUFF_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const empty = new CanvasTexture(canvas);
    empty.needsUpdate = true;
    return empty;
  }

  const cx = SMOKE_PUFF_SIZE * 0.5;
  const cy = SMOKE_PUFF_SIZE * 0.5;
  const radius = SMOKE_PUFF_SIZE * 0.48;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
  gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.45)');
  gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.12)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.clearRect(0, 0, SMOKE_PUFF_SIZE, SMOKE_PUFF_SIZE);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SMOKE_PUFF_SIZE, SMOKE_PUFF_SIZE);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
};

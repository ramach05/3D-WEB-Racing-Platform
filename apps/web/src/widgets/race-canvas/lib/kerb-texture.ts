import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { kerbPalette } from '@/shared/config';

/** Двухпиксельная текстура красный/белый для тайлинга вдоль V */
export const createKerbTexture = (): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2d canvas context unavailable');
  }

  ctx.fillStyle = kerbPalette.red;
  ctx.fillRect(0, 0, 4, 1);
  ctx.fillStyle = kerbPalette.white;
  ctx.fillRect(0, 1, 4, 1);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
};

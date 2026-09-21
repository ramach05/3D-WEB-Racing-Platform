import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasTexture } from 'three';
import {
  createStartLightHousingTexture,
  createStartLightLensTextures,
  getSharedStartLightHousingTexture,
  getSharedStartLightLensTextures,
  resetStartLightTextureCache,
} from './start-light-textures';

/** Минимальный 2d-контекст для процедурных texture-тестов в jsdom */
const installCanvas2dMock = (): void => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((
    type: string,
  ): CanvasRenderingContext2D | null => {
    if (type !== '2d') {
      return null;
    }
    const ctx = {
      createImageData: (width: number, height: number): ImageData => ({
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
        colorSpace: 'srgb',
      }),
      putImageData: vi.fn(),
    };
    return ctx as CanvasRenderingContext2D;
  }) as typeof HTMLCanvasElement.prototype.getContext);
};

describe('start-light-textures', () => {
  beforeEach(() => {
    installCanvas2dMock();
    resetStartLightTextureCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates lens map and emissiveMap as CanvasTextures', () => {
    const { map, emissiveMap } = createStartLightLensTextures(64);
    expect(map).toBeInstanceOf(CanvasTexture);
    expect(emissiveMap).toBeInstanceOf(CanvasTexture);
    expect(map.image.width).toBe(64);
    expect(emissiveMap.image.width).toBe(64);
  });

  it('creates housing texture as CanvasTexture', () => {
    const tex = createStartLightHousingTexture(64);
    expect(tex).toBeInstanceOf(CanvasTexture);
    expect(tex.image.width).toBe(64);
  });

  it('reuses shared lens and housing textures', () => {
    const a = getSharedStartLightLensTextures(64);
    const b = getSharedStartLightLensTextures(128);
    expect(a.map).toBe(b.map);
    expect(a.emissiveMap).toBe(b.emissiveMap);

    const h1 = getSharedStartLightHousingTexture(64);
    const h2 = getSharedStartLightHousingTexture(128);
    expect(h1).toBe(h2);
  });
});

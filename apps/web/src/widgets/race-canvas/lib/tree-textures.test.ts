import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasTexture } from 'three';
import { createBarkTexture, getSharedBarkTexture } from './bark-texture';
import {
  createBroadleafFoliageTexture,
  createPineFoliageTexture,
  getSharedBroadleafFoliageTexture,
  getSharedPineFoliageTexture,
} from './foliage-texture';
import {
  BROADLEAF_CROWN_LOCAL_Y,
  BROADLEAF_CROWN_RADIUS,
  BROADLEAF_LOBES,
  PINE_CROWN_HEIGHT,
  PINE_CROWN_LOCAL_Y,
  PINE_CROWN_RADIUS,
  PINE_TIERS,
  TRUNK_HEIGHT,
  TRUNK_KIND_SCALE,
  TRUNK_LOCAL_Y,
  TRUNK_RADIUS,
  TRUNK_RADIUS_BOTTOM,
} from './tree-geometry';

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

describe('tree-geometry', () => {
  it('keeps trunk tapered wider at the base', () => {
    expect(TRUNK_RADIUS_BOTTOM).toBeGreaterThan(TRUNK_RADIUS);
    expect(TRUNK_LOCAL_Y).toBeCloseTo(TRUNK_HEIGHT / 2);
  });

  it('defines three pine tiers tapering upward', () => {
    expect(PINE_TIERS).toHaveLength(3);
    expect(PINE_TIERS[0]!.radius).toBeGreaterThan(PINE_TIERS[1]!.radius);
    expect(PINE_TIERS[1]!.radius).toBeGreaterThan(PINE_TIERS[2]!.radius);
    expect(PINE_TIERS[0]!.localY).toBeLessThan(PINE_TIERS[2]!.localY);
    expect(PINE_TIERS.filter((tier) => tier.castShadow)).toHaveLength(1);
  });

  it('defines overlapping broadleaf lobes with one shadow caster', () => {
    expect(BROADLEAF_LOBES.length).toBeGreaterThanOrEqual(3);
    expect(BROADLEAF_LOBES.filter((lobe) => lobe.castShadow)).toHaveLength(1);
    expect(BROADLEAF_CROWN_RADIUS).toBeGreaterThan(1);
    expect(BROADLEAF_CROWN_LOCAL_Y).toBeGreaterThan(TRUNK_HEIGHT);
  });

  it('exposes collider approximations covering the visual crown', () => {
    expect(PINE_CROWN_RADIUS).toBe(PINE_TIERS[0]!.radius);
    expect(PINE_CROWN_HEIGHT).toBeGreaterThan(PINE_TIERS[0]!.height);
    expect(PINE_CROWN_LOCAL_Y).toBeGreaterThan(TRUNK_HEIGHT);
    expect(TRUNK_KIND_SCALE.pine.y).toBeGreaterThan(TRUNK_KIND_SCALE.broadleaf.y);
  });
});

describe('bark-texture', () => {
  beforeEach(() => {
    installCanvas2dMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a square canvas bark map', () => {
    const texture = createBarkTexture(64);
    expect(texture).toBeInstanceOf(CanvasTexture);
    expect(texture.image.width).toBe(64);
    expect(texture.image.height).toBe(64);
    expect(texture.repeat.x).toBeGreaterThan(1);
    texture.dispose();
  });

  it('reuses a shared bark texture singleton', () => {
    const a = getSharedBarkTexture(64);
    const b = getSharedBarkTexture(128);
    expect(a).toBe(b);
  });
});

describe('foliage-texture', () => {
  beforeEach(() => {
    installCanvas2dMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates pine and broadleaf foliage maps', () => {
    const pine = createPineFoliageTexture(64);
    const broadleaf = createBroadleafFoliageTexture(64);
    expect(pine).toBeInstanceOf(CanvasTexture);
    expect(broadleaf).toBeInstanceOf(CanvasTexture);
    expect(pine.image.width).toBe(64);
    expect(broadleaf.image.width).toBe(64);
    pine.dispose();
    broadleaf.dispose();
  });

  it('reuses shared foliage texture singletons', () => {
    expect(getSharedPineFoliageTexture(64)).toBe(getSharedPineFoliageTexture(128));
    expect(getSharedBroadleafFoliageTexture(64)).toBe(getSharedBroadleafFoliageTexture(128));
  });
});

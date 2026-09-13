import { describe, expect, it } from 'vitest';
import {
  BILLBOARD_COLLIDER,
  BILLBOARD_FLOOD,
  BILLBOARD_FLOOD_SPOT,
  BILLBOARD_FRAME_TOP_Y,
  BILLBOARD_PANEL_CENTER_Y,
  BILLBOARD_PANEL_HEIGHT,
  BILLBOARD_PANEL_WIDTH,
  BILLBOARD_POST_HEIGHT,
  BILLBOARD_ROAD_TOP_Y,
} from './billboard';
import { BILLBOARD_AD_COPY, getBillboardAdCopy } from './billboard-ads';
import { BILLBOARD_AD_IDS } from '@/entities/track';

describe('billboard constants', () => {
  it('keeps trackside billboard proportions', () => {
    expect(BILLBOARD_PANEL_WIDTH).toBeGreaterThan(3.5);
    expect(BILLBOARD_PANEL_HEIGHT).toBeGreaterThan(1.8);
    expect(BILLBOARD_POST_HEIGHT).toBeGreaterThan(BILLBOARD_PANEL_CENTER_Y);
    expect(BILLBOARD_PANEL_CENTER_Y).toBeGreaterThan(BILLBOARD_ROAD_TOP_Y + 1);
    expect(BILLBOARD_FRAME_TOP_Y).toBeGreaterThan(BILLBOARD_PANEL_CENTER_Y);
  });

  it('sizes colliders from visual geometry', () => {
    expect(BILLBOARD_COLLIDER.post.halfHeight).toBeCloseTo(BILLBOARD_POST_HEIGHT / 2);
    expect(BILLBOARD_COLLIDER.panel.halfDepth).toBeGreaterThan(BILLBOARD_PANEL_WIDTH / 2);
  });

  it('defines two gooseneck floodlights over the face', () => {
    expect(BILLBOARD_FLOOD.zSpan).toBeGreaterThan(0.8);
    expect(BILLBOARD_FLOOD.armLength).toBeGreaterThan(0.5);
    expect(BILLBOARD_FLOOD.neckLength).toBeGreaterThan(0.15);
    expect(BILLBOARD_FLOOD.riserHeight).toBeGreaterThan(0.08);
    expect(BILLBOARD_FLOOD.armPitch).toBeGreaterThan(0.1);
    expect(BILLBOARD_FLOOD.neckPitch).toBeGreaterThan(0.5);
    expect(BILLBOARD_FLOOD_SPOT.intensity).toBeGreaterThan(8);
    expect(BILLBOARD_FLOOD_SPOT.angle).toBeGreaterThan(0.7);
    expect(BILLBOARD_FLOOD_SPOT.penumbra).toBeGreaterThan(0.8);
  });
});

describe('billboard ads', () => {
  it('has localized copy for brand ads', () => {
    for (const locale of ['en', 'ru'] as const) {
      for (const adId of BILLBOARD_AD_IDS) {
        if (adId === 'for-rent') {
          continue;
        }
        const copy = getBillboardAdCopy(adId, locale);
        expect(copy.brand.length).toBeGreaterThan(0);
        expect(copy.slogan.length).toBeGreaterThan(0);
        expect(copy.punchline.length).toBeGreaterThan(0);
        expect(copy.tagline.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps for-rent as a single localized line', () => {
    expect(getBillboardAdCopy('for-rent', 'en').slogan).toBe('Your ad here');
    expect(getBillboardAdCopy('for-rent', 'ru').slogan).toBe('Место для вашей рекламы');
    expect(getBillboardAdCopy('for-rent', 'ru').brand).toBe('');
    expect(getBillboardAdCopy('for-rent', 'ru').punchline).toBe('');
  });

  it('keeps brand names stable across locales', () => {
    expect(BILLBOARD_AD_COPY.en['torque-cola'].brand).toBe(
      BILLBOARD_AD_COPY.ru['torque-cola'].brand,
    );
  });
});

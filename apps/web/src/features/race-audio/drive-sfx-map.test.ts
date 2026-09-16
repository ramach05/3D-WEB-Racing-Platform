import { describe, expect, it } from 'vitest';
import {
  IMPACT_FULL_MS,
  mapImpactFromSpeed,
  mapOilSlapFromSpeed,
  mapWallScrape,
  WALL_SCRAPE_FULL_LOSS,
} from './drive-sfx-map';

describe('mapWallScrape', () => {
  it('is 0 when desired is near zero or no loss', () => {
    expect(mapWallScrape(0.5, 0.5)).toBe(0);
    expect(mapWallScrape(20, 20)).toBe(0);
  });

  it('reaches 1 at configured loss ratio', () => {
    const desired = 20;
    const slid = desired * (1 - WALL_SCRAPE_FULL_LOSS);
    expect(mapWallScrape(desired, slid)).toBeCloseTo(1, 5);
    expect(mapWallScrape(desired, 0)).toBe(1);
  });
});

describe('mapImpactFromSpeed', () => {
  it('is 0 below crawl and 1 at full', () => {
    expect(mapImpactFromSpeed(0.4)).toBe(0);
    expect(mapImpactFromSpeed(IMPACT_FULL_MS)).toBe(1);
    expect(mapImpactFromSpeed(IMPACT_FULL_MS / 2)).toBeCloseTo(0.5, 5);
  });
});

describe('mapOilSlapFromSpeed', () => {
  it('scales with speed above crawl', () => {
    expect(mapOilSlapFromSpeed(1)).toBe(0);
    expect(mapOilSlapFromSpeed(8)).toBeCloseTo(0.5, 5);
    expect(mapOilSlapFromSpeed(20)).toBe(1);
  });
});

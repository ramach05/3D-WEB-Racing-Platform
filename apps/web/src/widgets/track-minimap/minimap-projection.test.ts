import { describe, expect, it } from 'vitest';
import { coastalOvalTrack } from '@/entities/track';
import {
  createMinimapProjection,
  MINIMAP_VIEW_HEIGHT,
  MINIMAP_VIEW_WIDTH,
} from './minimap-projection';

describe('createMinimapProjection', () => {
  const projection = createMinimapProjection(coastalOvalTrack);

  it('maps world origin to viewBox center', () => {
    expect(projection.project(0, 0)).toEqual({
      x: MINIMAP_VIEW_WIDTH / 2,
      y: MINIMAP_VIEW_HEIGHT / 2,
    });
  });

  it('maps centerline extremes inside the viewBox', () => {
    const east = projection.project(58, 0);
    expect(east.x).toBeGreaterThan(MINIMAP_VIEW_WIDTH / 2);
    expect(east.x).toBeLessThan(MINIMAP_VIEW_WIDTH);
    expect(east.y).toBeCloseTo(MINIMAP_VIEW_HEIGHT / 2, 1);
  });

  it('maps padding corners to viewBox bounds', () => {
    const padding = coastalOvalTrack.roadWidth + 8;
    expect(projection.project(58 + padding, 36 + padding)).toEqual({
      x: MINIMAP_VIEW_WIDTH,
      y: MINIMAP_VIEW_HEIGHT,
    });
  });
});

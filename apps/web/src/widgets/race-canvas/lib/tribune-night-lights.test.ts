import { describe, expect, it } from 'vitest';
import { SECTION_PITCH } from '@/entities/track';
import {
  TRIBUNE_CROWD_WASH,
  TRIBUNE_EDGE_SPOT,
  TRIBUNE_EDGE_Z_SIGNS,
  TRIBUNE_FLOOD,
  tribuneDepthX,
  tribuneEdgeAimX,
  tribuneEdgeAimY,
  tribuneEdgeAimZ,
  tribuneEdgeLightX,
  tribuneEdgeLightY,
  tribuneEdgeLightZ,
  tribuneHalfSpanZ,
} from './tribune-night-lights';

describe('tribune edge floodlights', () => {
  it('defines exactly two roof-edge placements', () => {
    expect(TRIBUNE_EDGE_Z_SIGNS).toHaveLength(2);
    expect(new Set(TRIBUNE_EDGE_Z_SIGNS).size).toBe(2);
    expect(TRIBUNE_FLOOD.housingDepthFraction).toBeGreaterThan(0.2);
    expect(TRIBUNE_FLOOD.housingDepthFraction).toBeLessThan(0.5);
  });

  it('keeps two soft spots and a lighter crowd wash for FPS', () => {
    expect(TRIBUNE_EDGE_SPOT.intensity).toBeGreaterThan(25);
    expect(TRIBUNE_EDGE_SPOT.intensity).toBeLessThan(60);
    expect(TRIBUNE_EDGE_SPOT.distance).toBeGreaterThan(10);
    expect(TRIBUNE_EDGE_SPOT.distance).toBeLessThanOrEqual(16);
    expect(TRIBUNE_EDGE_SPOT.angle).toBeGreaterThan(0.7);
    expect(TRIBUNE_EDGE_SPOT.penumbra).toBeGreaterThan(0.7);
    expect(TRIBUNE_CROWD_WASH.shirtAdd).toBeGreaterThan(0.1);
    expect(TRIBUNE_CROWD_WASH.shirtAdd).toBeLessThan(0.3);
  });

  it('places lights under the canopy at outer edges aiming inward and down', () => {
    const tribuneInnerX = 10;
    const sideSign = 1;
    const lightX = tribuneEdgeLightX(tribuneInnerX, sideSign);
    const aimX = tribuneEdgeAimX(tribuneInnerX, sideSign);
    const lightZ = tribuneEdgeLightZ(1);
    const aimZ = tribuneEdgeAimZ(1);

    expect(lightX).toBeGreaterThan(tribuneInnerX);
    expect(lightX).toBeLessThan(tribuneInnerX + tribuneDepthX());
    expect(aimX).toBeGreaterThan(lightX);
    expect(Math.abs(lightZ)).toBeGreaterThan(SECTION_PITCH);
    expect(Math.abs(lightZ)).toBeLessThan(tribuneHalfSpanZ());
    expect(Math.abs(aimZ)).toBeLessThan(Math.abs(lightZ));
    expect(tribuneEdgeLightY()).toBeGreaterThan(tribuneEdgeAimY());
    expect(tribuneEdgeLightZ(-1)).toBe(-tribuneEdgeLightZ(1));
  });

  it('mirrors X for the opposite tribune side', () => {
    const tribuneInnerX = -10;
    const sideSign = -1;
    const lightX = tribuneEdgeLightX(tribuneInnerX, sideSign);
    expect(lightX).toBeLessThan(tribuneInnerX);
    expect(lightX).toBeGreaterThan(tribuneInnerX - tribuneDepthX());
  });
});

import { describe, expect, it } from 'vitest';
import { coastalOvalTrack } from './config';
import {
  ROW_DEPTH,
  SECTION_PITCH,
  SECTION_WIDTH,
  TREE_EXCLUSION_PADDING,
  TRIBUNE_MARGIN,
  TRIBUNE_ROWS,
  WALL_OFFSET,
  buildTribuneTreeExclusionZone,
} from './tribune-layout';

describe('buildTribuneTreeExclusionZone', () => {
  it('builds zone for left side from real track', () => {
    const { startFinishLine, roadWidth } = coastalOvalTrack;

    const zone = buildTribuneTreeExclusionZone({
      startFinishLine,
      roadWidth,
      side: 'left',
    });

    const tribuneDepth = TRIBUNE_ROWS * ROW_DEPTH;
    const halfDepthX = tribuneDepth / 2 + TREE_EXCLUSION_PADDING;
    const halfSpanZ = SECTION_PITCH + SECTION_WIDTH / 2 + TREE_EXCLUSION_PADDING;
    expect(zone.rotationY).toBe(startFinishLine.rotationY);
    expect(zone.size).toEqual([halfDepthX * 2, 8, halfSpanZ * 2]);
    expect(zone.position[1]).toBe(0);
  });

  it('mirrors center for right vs left', () => {
    const { startFinishLine, roadWidth } = coastalOvalTrack;

    const left = buildTribuneTreeExclusionZone({
      startFinishLine,
      roadWidth,
      side: 'left',
    });
    const right = buildTribuneTreeExclusionZone({
      startFinishLine,
      roadWidth,
      side: 'right',
    });

    expect(left.size).toEqual(right.size);
    expect(left.position[0]).not.toBe(right.position[0]);
    const midX = (left.position[0] + right.position[0]) / 2;
    expect(midX).toBeCloseTo(startFinishLine.position[0], 5);
  });

  it('places center outside the road edge', () => {
    const startFinishLine = {
      position: [0, 0, 0] as const,
      size: [10, 1, 2] as const,
      rotationY: 0,
    };
    const roadWidth = 9;

    const zone = buildTribuneTreeExclusionZone({
      startFinishLine,
      roadWidth,
      side: 'left',
    });

    const tribuneDepth = TRIBUNE_ROWS * ROW_DEPTH;
    const expectedCenterX = roadWidth / 2 + WALL_OFFSET + TRIBUNE_MARGIN + tribuneDepth / 2;
    expect(zone.position[0]).toBeCloseTo(expectedCenterX, 5);
    expect(zone.position[2]).toBeCloseTo(0, 5);
  });
});

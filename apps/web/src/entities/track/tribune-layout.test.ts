import { describe, expect, it } from 'vitest';
import { coastalOvalTrack } from './config';
import {
  CANOPY_POSTS_PER_SECTION,
  FOUNDATION_OVERHANG,
  ROW_DEPTH,
  SECTION_PITCH,
  SECTION_WIDTH,
  SECTION_Z_OFFSETS,
  STAIR_WIDTH,
  TREE_EXCLUSION_PADDING,
  TRIBUNE_MARGIN,
  TRIBUNE_ROWS,
  WALL_OFFSET,
  buildTribuneBackRails,
  buildTribuneCanopyPosts,
  buildTribuneSeatPlanks,
  buildTribuneStairRails,
  buildTribuneStairs,
  buildTribuneTreeExclusionZone,
  canopyUndersideY,
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
    const halfDepthX = tribuneDepth / 2 + FOUNDATION_OVERHANG + TREE_EXCLUSION_PADDING;
    const halfSpanZ = SECTION_PITCH + SECTION_WIDTH / 2 + STAIR_WIDTH + TREE_EXCLUSION_PADDING;
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
    // Race runs against the centerline → in the finish local frame the car looks toward −Z, its left side = −X
    expect(zone.position[0]).toBeCloseTo(-expectedCenterX, 5);
    expect(zone.position[2]).toBeCloseTo(0, 5);
  });
});

describe('buildTribuneCanopyPosts', () => {
  it('places rear-only posts reaching the canopy underside', () => {
    const tribuneInnerX = 8;
    const posts = buildTribuneCanopyPosts(tribuneInnerX, 1);

    expect(posts).toHaveLength(CANOPY_POSTS_PER_SECTION);
    const underside = canopyUndersideY();
    for (const post of posts) {
      const top = post.position[1] + post.height / 2;
      expect(top).toBeCloseTo(underside, 5);
      expect(post.position[0]).toBeGreaterThan(tribuneInnerX + TRIBUNE_ROWS * ROW_DEPTH * 0.5);
    }
  });

  it('mirrors X for the opposite side', () => {
    const left = buildTribuneCanopyPosts(8, 1);
    const right = buildTribuneCanopyPosts(-8, -1);

    expect(right.map((p) => p.position[0])).toEqual(left.map((p) => -p.position[0]));
  });
});

describe('buildTribuneSeatPlanks', () => {
  it('places seat and backrest per row', () => {
    const { seats, backs } = buildTribuneSeatPlanks(8, 1);
    expect(seats).toHaveLength(TRIBUNE_ROWS);
    expect(backs).toHaveLength(TRIBUNE_ROWS);
    for (let row = 0; row < TRIBUNE_ROWS; row += 1) {
      const seat = seats[row];
      expect(seat).toBeDefined();
      expect(seat!.position[1]).toBeGreaterThan(row * 0.65);
    }
  });
});

describe('buildTribuneBackRails', () => {
  it('builds open tube rails instead of a solid wall', () => {
    const rails = buildTribuneBackRails(8, 1);
    expect(rails.length).toBeGreaterThan(3);
    // All parts are thin — no solid sheet
    for (const part of rails) {
      expect(Math.min(part.size[0], part.size[1], part.size[2])).toBeLessThan(0.08);
    }
  });
});

describe('buildTribuneStairs', () => {
  it('builds solid steps from ground on outer end sections only', () => {
    const endA = buildTribuneStairs({ tribuneInnerX: 8, sideSign: 1, sectionIndex: 0 });
    const middle = buildTribuneStairs({ tribuneInnerX: 8, sideSign: 1, sectionIndex: 1 });
    const endB = buildTribuneStairs({
      tribuneInnerX: 8,
      sideSign: 1,
      sectionIndex: SECTION_Z_OFFSETS.length - 1,
    });

    expect(endA).toHaveLength(TRIBUNE_ROWS);
    expect(middle).toHaveLength(0);
    expect(endB).toHaveLength(TRIBUNE_ROWS);
    const firstA = endA[0];
    const firstB = endB[0];
    expect(firstA).toBeDefined();
    expect(firstB).toBeDefined();
    expect(firstA!.position[2]).toBeLessThan(0);
    expect(firstB!.position[2]).toBeGreaterThan(0);
    // Bottom face of the first step is on the ground
    expect(firstA!.position[1] - firstA!.size[1] / 2).toBeCloseTo(0, 5);
    // Height grows with the row
    expect(endA[TRIBUNE_ROWS - 1]!.size[1]).toBeGreaterThan(firstA!.size[1]);
  });
});

describe('buildTribuneStairRails', () => {
  it('uses inclined handrail with rotation instead of a floating horizontal bar', () => {
    const steps = buildTribuneStairs({ tribuneInnerX: 8, sideSign: 1, sectionIndex: 0 });
    const rails = buildTribuneStairRails(steps, 8, 1);
    const inclined = rails.filter((r) => r.rotation != null);
    expect(inclined.length).toBeGreaterThanOrEqual(1);
    for (const part of inclined) {
      expect(part.rotation![2]).not.toBeCloseTo(0, 2);
    }
    // No long horizontal "stick" along the whole depth at mid height
    const floatingBar = rails.find(
      (r) => r.rotation == null && r.size[0] > TRIBUNE_ROWS * ROW_DEPTH * 0.8 && r.size[1] < 0.1,
    );
    expect(floatingBar).toBeUndefined();
  });
});

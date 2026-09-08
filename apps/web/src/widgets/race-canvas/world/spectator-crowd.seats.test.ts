import { describe, expect, it } from 'vitest';
import { SECTION_PITCH, SECTION_WIDTH } from '@/entities/track';
import { buildSpectatorSeats } from './spectator-crowd';

describe('buildSpectatorSeats', () => {
  it('caps seats at requested count', () => {
    const seats = buildSpectatorSeats({
      tribuneInnerX: 10,
      sideSign: 1,
      count: 7,
      sectionWidth: SECTION_WIDTH,
      sectionPitch: SECTION_PITCH,
    });

    expect(seats).toHaveLength(7);
  });

  it('places seats on the correct side', () => {
    const seats = buildSpectatorSeats({
      tribuneInnerX: 5,
      sideSign: 1,
      count: 10,
      sectionWidth: SECTION_WIDTH,
      sectionPitch: SECTION_PITCH,
    });

    for (const seat of seats) {
      expect(seat.x).toBeGreaterThan(5);
      expect(seat.y).toBeGreaterThan(0);
      expect(Math.abs(seat.z)).toBeLessThanOrEqual(SECTION_PITCH / 2);
      expect(seat.yaw).toBeCloseTo(Math.PI / 2, 5);
    }
  });

  it('mirrors yaw for the opposite side', () => {
    const seats = buildSpectatorSeats({
      tribuneInnerX: -5,
      sideSign: -1,
      count: 3,
      sectionWidth: SECTION_WIDTH,
      sectionPitch: SECTION_PITCH,
    });

    expect(seats[0]?.yaw).toBeCloseTo(-Math.PI / 2, 5);
    for (const seat of seats) {
      expect(seat.x).toBeLessThan(-5);
    }
  });
});

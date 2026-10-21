import { describe, expect, it } from 'vitest';
import { SECTION_PITCH, SECTION_WIDTH } from '@/entities/track';
import { buildSpectatorSeats } from './spectator-crowd';
import type { TSpectatorBehavior } from './spectator-crowd.types';

const BEHAVIORS: readonly TSpectatorBehavior[] = [
  'watch',
  'lean',
  'waveOne',
  'clap',
  'cheer',
  'phone',
];

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

  it('assigns a valid behavior and wave side to every seat', () => {
    const seats = buildSpectatorSeats({
      tribuneInnerX: 8,
      sideSign: 1,
      count: 30,
      sectionWidth: SECTION_WIDTH,
      sectionPitch: SECTION_PITCH,
    });

    for (const seat of seats) {
      expect(BEHAVIORS).toContain(seat.behavior);
      expect(['left', 'right']).toContain(seat.waveSide);
      expect(typeof seat.hasCap).toBe('boolean');
      expect(typeof seat.hasFlag).toBe('boolean');
      expect(typeof seat.hasHair).toBe('boolean');
      if (seat.hasCap) {
        expect(seat.hasHair).toBe(false);
      }
    }
  });

  it('does not make every spectator waveOne', () => {
    const seats = buildSpectatorSeats({
      tribuneInnerX: 8,
      sideSign: 1,
      count: 60,
      sectionWidth: SECTION_WIDTH,
      sectionPitch: SECTION_PITCH,
    });

    const waveOneCount = seats.filter((seat) => seat.behavior === 'waveOne').length;
    const watchCount = seats.filter((seat) => seat.behavior === 'watch').length;

    expect(waveOneCount).toBeLessThan(seats.length * 0.5);
    expect(watchCount).toBeGreaterThan(0);
  });

  it('keeps accessories as a minority of the crowd', () => {
    const seats = buildSpectatorSeats({
      tribuneInnerX: 8,
      sideSign: 1,
      count: 80,
      sectionWidth: SECTION_WIDTH,
      sectionPitch: SECTION_PITCH,
    });

    const capRatio = seats.filter((seat) => seat.hasCap).length / seats.length;
    const flagRatio = seats.filter((seat) => seat.hasFlag).length / seats.length;

    expect(capRatio).toBeGreaterThan(0.1);
    expect(capRatio).toBeLessThan(0.6);
    expect(flagRatio).toBeLessThan(0.2);
  });
});

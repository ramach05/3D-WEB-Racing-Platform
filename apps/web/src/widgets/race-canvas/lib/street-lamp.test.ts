import { describe, expect, it } from 'vitest';
import {
  STREET_LAMP_ARM_JOINTS,
  STREET_LAMP_ARM_REACH,
  STREET_LAMP_COLLIDER,
  STREET_LAMP_LUMINAIRE_LOCAL_X,
  STREET_LAMP_LUMINAIRE_Y,
  STREET_LAMP_POLE_HEIGHT,
  STREET_LAMP_POLE_TOP_Y,
  STREET_LAMP_SPOT,
  STREET_LAMP_SPOT_SHADOW,
} from './street-lamp';

describe('street-lamp constants', () => {
  it('keeps municipal lamp proportions', () => {
    expect(STREET_LAMP_POLE_HEIGHT).toBeGreaterThan(5);
    expect(STREET_LAMP_ARM_REACH).toBeGreaterThan(1);
    expect(STREET_LAMP_LUMINAIRE_Y).toBeGreaterThan(STREET_LAMP_POLE_HEIGHT);
  });

  it('connects cobra-arm joints into a continuous reach', () => {
    const [pole, elbow, tip] = STREET_LAMP_ARM_JOINTS;
    expect(pole.x).toBe(0);
    expect(pole.y).toBeCloseTo(STREET_LAMP_POLE_TOP_Y);
    expect(elbow.x).toBeGreaterThan(pole.x);
    expect(elbow.y).toBeGreaterThan(pole.y);
    expect(tip.x).toBeCloseTo(STREET_LAMP_LUMINAIRE_LOCAL_X);
    expect(tip.x).toBeGreaterThan(elbow.x);
    expect(tip.y).toBeCloseTo(STREET_LAMP_LUMINAIRE_Y);
    expect(tip.y).toBeLessThan(elbow.y);
  });

  it('uses soft spot without requiring shadows on every lamp', () => {
    expect(STREET_LAMP_SPOT.penumbra).toBeGreaterThan(0.4);
    expect(STREET_LAMP_SPOT.distance).toBeGreaterThan(10);
    expect(STREET_LAMP_SPOT.intensity).toBeGreaterThan(80);
    expect(STREET_LAMP_COLLIDER.halfHeight).toBeCloseTo(STREET_LAMP_POLE_HEIGHT / 2);
  });

  it('keeps a low-budget single-lamp shadow map', () => {
    expect(STREET_LAMP_SPOT_SHADOW.mapSize).toBe(256);
    expect(STREET_LAMP_SPOT_SHADOW.switchHysteresis).toBeGreaterThan(0);
    expect(STREET_LAMP_SPOT_SHADOW.near).toBeLessThan(STREET_LAMP_SPOT.distance);
  });
});

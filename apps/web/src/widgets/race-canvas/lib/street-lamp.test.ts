import { describe, expect, it } from 'vitest';
import {
  STREET_LAMP_ARM_REACH,
  STREET_LAMP_COLLIDER,
  STREET_LAMP_LUMINAIRE_Y,
  STREET_LAMP_POLE_HEIGHT,
  STREET_LAMP_SPOT,
} from './street-lamp';

describe('street-lamp constants', () => {
  it('keeps municipal lamp proportions', () => {
    expect(STREET_LAMP_POLE_HEIGHT).toBeGreaterThan(5);
    expect(STREET_LAMP_ARM_REACH).toBeGreaterThan(1);
    expect(STREET_LAMP_LUMINAIRE_Y).toBeGreaterThan(STREET_LAMP_POLE_HEIGHT);
  });

  it('uses soft spot without requiring shadows', () => {
    expect(STREET_LAMP_SPOT.penumbra).toBeGreaterThan(0.4);
    expect(STREET_LAMP_SPOT.distance).toBeGreaterThan(10);
    expect(STREET_LAMP_SPOT.intensity).toBeGreaterThan(80);
    expect(STREET_LAMP_COLLIDER.halfHeight).toBeCloseTo(STREET_LAMP_POLE_HEIGHT / 2);
  });
});

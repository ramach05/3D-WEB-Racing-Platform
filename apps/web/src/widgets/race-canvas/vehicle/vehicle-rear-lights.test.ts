import { describe, expect, it } from 'vitest';
import {
  REAR_LIGHT_EMISSIVE_BRAKE,
  REAR_LIGHT_EMISSIVE_IDLE,
  REAR_LIGHT_EMISSIVE_REVERSE,
  REVERSE_LIGHT_SPEED_THRESHOLD,
  rearLightEmissiveIntensity,
  resolveRearLightMode,
} from '@/widgets/race-canvas/vehicle/vehicle-rear-lights';

describe('resolveRearLightMode', () => {
  it('returns idle when brake is released and speed is not reverse', () => {
    expect(resolveRearLightMode(0, 10)).toBe('idle');
    expect(resolveRearLightMode(0, 0)).toBe('idle');
    expect(resolveRearLightMode(0, REVERSE_LIGHT_SPEED_THRESHOLD)).toBe('idle');
  });

  it('returns brake when pedal is pressed while moving forward or stopped', () => {
    expect(resolveRearLightMode(1, 15)).toBe('brake');
    expect(resolveRearLightMode(1, 0)).toBe('brake');
    expect(resolveRearLightMode(0.5, -0.1)).toBe('brake');
  });

  it('returns reverse below the speed threshold even with brake held', () => {
    expect(resolveRearLightMode(1, -1)).toBe('reverse');
    expect(resolveRearLightMode(0, -5)).toBe('reverse');
    expect(resolveRearLightMode(1, REVERSE_LIGHT_SPEED_THRESHOLD - 0.01)).toBe('reverse');
  });
});

describe('rearLightEmissiveIntensity', () => {
  it('uses idle intensity for idle mode', () => {
    expect(rearLightEmissiveIntensity('idle', 0)).toBe(REAR_LIGHT_EMISSIVE_IDLE);
    expect(rearLightEmissiveIntensity('idle', 1)).toBe(REAR_LIGHT_EMISSIVE_IDLE);
  });

  it('lerps brake intensity by pedal amount', () => {
    expect(rearLightEmissiveIntensity('brake', 0)).toBe(REAR_LIGHT_EMISSIVE_IDLE);
    expect(rearLightEmissiveIntensity('brake', 1)).toBe(REAR_LIGHT_EMISSIVE_BRAKE);
    expect(rearLightEmissiveIntensity('brake', 0.5)).toBeCloseTo(
      (REAR_LIGHT_EMISSIVE_IDLE + REAR_LIGHT_EMISSIVE_BRAKE) / 2,
      5,
    );
  });

  it('uses full reverse intensity', () => {
    expect(rearLightEmissiveIntensity('reverse', 0)).toBe(REAR_LIGHT_EMISSIVE_REVERSE);
    expect(rearLightEmissiveIntensity('reverse', 1)).toBe(REAR_LIGHT_EMISSIVE_REVERSE);
  });
});

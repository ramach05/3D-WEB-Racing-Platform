import { describe, expect, it } from 'vitest';
import { DEFAULT_VEHICLE_ID, getVehicle, isVehicleId, VEHICLES } from './catalog';

describe('vehicle catalog', () => {
  it('lists hatchback, sedan and pickup', () => {
    expect(VEHICLES).toHaveLength(3);
    expect(VEHICLES.map((vehicle) => vehicle.id)).toEqual(['hatchback', 'sedan', 'pickup']);
  });

  it('defaults to hatchback gltf', () => {
    expect(DEFAULT_VEHICLE_ID).toBe('hatchback');
    expect(getVehicle(DEFAULT_VEHICLE_ID)?.bodyKind).toBe('gltf');
  });

  it('marks all garage bodies as gltf CarConcept variants', () => {
    for (const vehicle of VEHICLES) {
      expect(vehicle.bodyKind).toBe('gltf');
      expect(vehicle.gltfPath).toMatch(/car-concept\.glb$/);
    }
  });

  it('validates vehicle ids', () => {
    expect(isVehicleId('hatchback')).toBe(true);
    expect(isVehicleId('truck')).toBe(false);
  });
});

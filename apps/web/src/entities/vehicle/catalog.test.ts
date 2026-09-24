import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VEHICLE_ID,
  getVehicle,
  isVehicleId,
  JUKE_GLTF_PATH,
  PICKUP_GLTF_PATH,
  SCIROCCO_GLTF_PATH,
  SEDAN_GLTF_PATH,
  VEHICLES,
} from './catalog';

describe('vehicle catalog', () => {
  it('lists five garage bodies in order', () => {
    expect(VEHICLES).toHaveLength(5);
    expect(VEHICLES.map((vehicle) => vehicle.id)).toEqual([
      'hatchback',
      'sedan',
      'pickup',
      'juke',
      'scirocco',
    ]);
  });

  it('defaults to hatchback (cyberpunk) gltf', () => {
    expect(DEFAULT_VEHICLE_ID).toBe('hatchback');
    expect(getVehicle(DEFAULT_VEHICLE_ID)?.bodyKind).toBe('gltf');
  });

  it('uses a distinct GLB path per garage body', () => {
    expect(getVehicle('hatchback')?.gltfPath).toMatch(/car-concept\.glb$/);
    expect(getVehicle('sedan')?.gltfPath).toBe(SEDAN_GLTF_PATH);
    expect(getVehicle('pickup')?.gltfPath).toBe(PICKUP_GLTF_PATH);
    expect(getVehicle('juke')?.gltfPath).toBe(JUKE_GLTF_PATH);
    expect(getVehicle('scirocco')?.gltfPath).toBe(SCIROCCO_GLTF_PATH);
    expect(SEDAN_GLTF_PATH).toMatch(/logan\.glb$/);
    expect(PICKUP_GLTF_PATH).toMatch(/ram\.glb$/);
    const paths = new Set(VEHICLES.map((vehicle) => vehicle.gltfPath));
    expect(paths.size).toBe(5);
  });

  it('validates vehicle ids', () => {
    expect(isVehicleId('hatchback')).toBe(true);
    expect(isVehicleId('juke')).toBe(true);
    expect(isVehicleId('scirocco')).toBe(true);
    expect(isVehicleId('truck')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VEHICLE_ID,
  getVehicle,
  getVehicleFitTargetLength,
  isVehicleId,
  JUKE_GLTF_PATH,
  PICKUP_GLTF_PATH,
  SCIROCCO_GLTF_PATH,
  SEDAN_GLTF_PATH,
  VEHICLE_UNITS_PER_METER,
  VEHICLES,
} from './catalog';

describe('vehicle catalog', () => {
  it('lists five garage bodies in order', () => {
    expect(VEHICLES).toHaveLength(5);
    expect(VEHICLES.map((vehicle) => vehicle.id)).toEqual([
      'hatchback',
      'pickup',
      'scirocco',
      'sedan',
      'juke',
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

  it('fits every body to real-world class scale', () => {
    for (const vehicle of VEHICLES) {
      expect(vehicle.realLengthMeters, `${vehicle.id}: real length set`).toBeGreaterThan(0);
    }
    const target = (id: string) => getVehicleFitTargetLength(id)!;
    // Scale anchor: Ram TRX 5.71 m → 3.8 world units
    expect(target('pickup')).toBeCloseTo(3.8, 5);
    expect(VEHICLE_UNITS_PER_METER).toBeCloseTo(3.8 / 5.71, 10);
    // Real class hierarchy: TRX > Logan > Scirocco > hatch > Juke
    expect(target('pickup')).toBeGreaterThan(target('sedan'));
    expect(target('sedan')).toBeGreaterThan(target('scirocco'));
    expect(target('scirocco')).toBeGreaterThan(target('hatchback'));
    expect(target('hatchback')).toBeGreaterThan(target('juke'));
    expect(target('nope')).toBeUndefined();
  });

  it('validates vehicle ids', () => {
    expect(isVehicleId('hatchback')).toBe(true);
    expect(isVehicleId('juke')).toBe(true);
    expect(isVehicleId('scirocco')).toBe(true);
    expect(isVehicleId('truck')).toBe(false);
  });
});

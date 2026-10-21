import type { TVehicleDef, TVehicleId } from './types';

/** Paths to individual garage body GLB files */
export const HATCHBACK_GLTF_PATH = '/models/vehicle/car-concept.glb';
export const SEDAN_GLTF_PATH = '/models/vehicle/logan.glb';
export const PICKUP_GLTF_PATH = '/models/vehicle/ram.glb';
export const JUKE_GLTF_PATH = '/models/vehicle/juke.glb';
export const SCIROCCO_GLTF_PATH = '/models/vehicle/scirocco.glb';

/** Default body — Cyberpunk (hatchback) */
export const DEFAULT_VEHICLE_ID: TVehicleId = 'hatchback';

/**
 * World scale: world units per 1 meter of a real car. Anchor — the pickup:
 * Ram 1500 TRX 5.71 m → 3.8 units (the largest body fits into the track,
 * the rest are derived from the same scale).
 */
export const VEHICLE_UNITS_PER_METER = 3.8 / 5.71;

/**
 * Garage vehicle catalog — each body has its own GLB.
 * realLengthMeters — spec-sheet length; fit scales models to real
 * class proportions (otherwise all bodies flatten to one 3.3 length).
 */
export const VEHICLES: readonly TVehicleDef[] = [
  // C-class concept hatchback (loosely a Golf: ~4.2 m)
  { id: 'hatchback', bodyKind: 'gltf', gltfPath: HATCHBACK_GLTF_PATH, realLengthMeters: 4.2 },
  // Ram 1500 TRX: length 5710 mm
  { id: 'pickup', bodyKind: 'gltf', gltfPath: PICKUP_GLTF_PATH, realLengthMeters: 5.71 },
  // VW Scirocco III: length 4256 mm
  { id: 'scirocco', bodyKind: 'gltf', gltfPath: SCIROCCO_GLTF_PATH, realLengthMeters: 4.26 },
  // Renault Logan II: length 4346 mm
  { id: 'sedan', bodyKind: 'gltf', gltfPath: SEDAN_GLTF_PATH, realLengthMeters: 4.35 },
  // Nissan Juke I: length 4135 mm
  { id: 'juke', bodyKind: 'gltf', gltfPath: JUKE_GLTF_PATH, realLengthMeters: 4.14 },
] as const;

/** Fit target length from the real body length; undefined — fallback to the 3.3 capsule */
export const getVehicleFitTargetLength = (id: string): number | undefined => {
  const meters = getVehicle(id)?.realLengthMeters;
  return meters === undefined ? undefined : meters * VEHICLE_UNITS_PER_METER;
};

const vehicleById = Object.fromEntries(VEHICLES.map((vehicle) => [vehicle.id, vehicle])) as Record<
  TVehicleId,
  TVehicleDef
>;

/** Returns the vehicle description or undefined */
export const getVehicle = (id: string): TVehicleDef | undefined => vehicleById[id as TVehicleId];

/** Checks that a string is a valid body id */
export const isVehicleId = (value: string): value is TVehicleId => value in vehicleById;

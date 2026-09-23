import type { TVehicleDef, TVehicleId } from './types';

/** Путь к GLB кузовов (CarConcept — база для всех вариантов гаража) */
export const HATCHBACK_GLTF_PATH = '/models/vehicle/car-concept.glb';
export const VEHICLE_GLTF_PATH = HATCHBACK_GLTF_PATH;

/** Кузов по умолчанию — GLTF-хэтчбек */
export const DEFAULT_VEHICLE_ID: TVehicleId = 'hatchback';

/** Каталог машин гаража — один GLB, силуэт задаётся вариантом в VehicleModel */
export const VEHICLES: readonly TVehicleDef[] = [
  { id: 'hatchback', bodyKind: 'gltf', gltfPath: VEHICLE_GLTF_PATH },
  { id: 'sedan', bodyKind: 'gltf', gltfPath: VEHICLE_GLTF_PATH },
  { id: 'pickup', bodyKind: 'gltf', gltfPath: VEHICLE_GLTF_PATH },
] as const;

const vehicleById = Object.fromEntries(VEHICLES.map((vehicle) => [vehicle.id, vehicle])) as Record<
  TVehicleId,
  TVehicleDef
>;

/** Возвращает описание машины или undefined */
export const getVehicle = (id: string): TVehicleDef | undefined =>
  vehicleById[id as TVehicleId];

/** Проверяет, что строка — валидный id кузова */
export const isVehicleId = (value: string): value is TVehicleId => value in vehicleById;

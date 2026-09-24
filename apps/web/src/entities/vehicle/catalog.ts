import type { TVehicleDef, TVehicleId } from './types';

/** Пути к отдельным GLB кузовов гаража */
export const HATCHBACK_GLTF_PATH = '/models/vehicle/car-concept.glb';
export const SEDAN_GLTF_PATH = '/models/vehicle/logan.glb';
export const PICKUP_GLTF_PATH = '/models/vehicle/ram.glb';
export const JUKE_GLTF_PATH = '/models/vehicle/juke.glb';
export const SCIROCCO_GLTF_PATH = '/models/vehicle/scirocco.glb';

/** @deprecated Используйте путь из getVehicle(id).gltfPath */
export const VEHICLE_GLTF_PATH = HATCHBACK_GLTF_PATH;

/** Кузов по умолчанию — Киберпанк (hatchback) */
export const DEFAULT_VEHICLE_ID: TVehicleId = 'hatchback';

/** Каталог машин гаража — у каждого кузова свой GLB */
export const VEHICLES: readonly TVehicleDef[] = [
  { id: 'hatchback', bodyKind: 'gltf', gltfPath: HATCHBACK_GLTF_PATH },
  { id: 'sedan', bodyKind: 'gltf', gltfPath: SEDAN_GLTF_PATH },
  { id: 'pickup', bodyKind: 'gltf', gltfPath: PICKUP_GLTF_PATH },
  { id: 'juke', bodyKind: 'gltf', gltfPath: JUKE_GLTF_PATH },
  { id: 'scirocco', bodyKind: 'gltf', gltfPath: SCIROCCO_GLTF_PATH },
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

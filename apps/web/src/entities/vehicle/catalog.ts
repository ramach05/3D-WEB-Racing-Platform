import type { TVehicleDef, TVehicleId } from './types';

/** Пути к отдельным GLB кузовов гаража */
export const HATCHBACK_GLTF_PATH = '/models/vehicle/car-concept.glb';
export const SEDAN_GLTF_PATH = '/models/vehicle/logan.glb';
export const PICKUP_GLTF_PATH = '/models/vehicle/ram.glb';
export const JUKE_GLTF_PATH = '/models/vehicle/juke.glb';
export const SCIROCCO_GLTF_PATH = '/models/vehicle/scirocco.glb';

/** Кузов по умолчанию — Киберпанк (hatchback) */
export const DEFAULT_VEHICLE_ID: TVehicleId = 'hatchback';

/**
 * Масштаб мира: единиц мира в 1 метре реальной машины. Якорь — пикап:
 * Ram 1500 TRX 5.71 м → 3.8 ед. (самый крупный кузов влезает в трассу,
 * остальные считаются от той же шкалы).
 */
export const VEHICLE_UNITS_PER_METER = 3.8 / 5.71;

/**
 * Каталог машин гаража — у каждого кузова свой GLB.
 * realLengthMeters — паспортная длина, fit приводит модели к реальным
 * пропорциям классов (иначе все кузова сплющиваются к одной длине 3.3).
 */
export const VEHICLES: readonly TVehicleDef[] = [
  // Concept-hatch класса C (условный Golf: ~4.2 м)
  { id: 'hatchback', bodyKind: 'gltf', gltfPath: HATCHBACK_GLTF_PATH, realLengthMeters: 4.2 },
  // Ram 1500 TRX: длина 5710 мм
  { id: 'pickup', bodyKind: 'gltf', gltfPath: PICKUP_GLTF_PATH, realLengthMeters: 5.71 },
  // VW Scirocco III: длина 4256 мм
  { id: 'scirocco', bodyKind: 'gltf', gltfPath: SCIROCCO_GLTF_PATH, realLengthMeters: 4.26 },
  // Renault Logan II: длина 4346 мм
  { id: 'sedan', bodyKind: 'gltf', gltfPath: SEDAN_GLTF_PATH, realLengthMeters: 4.35 },
  // Nissan Juke I: длина 4135 мм
  { id: 'juke', bodyKind: 'gltf', gltfPath: JUKE_GLTF_PATH, realLengthMeters: 4.14 },
] as const;

/** Целевая длина fit из реальной длины кузова; undefined — fallback на капсулу 3.3 */
export const getVehicleFitTargetLength = (id: string): number | undefined => {
  const meters = getVehicle(id)?.realLengthMeters;
  return meters === undefined ? undefined : meters * VEHICLE_UNITS_PER_METER;
};

const vehicleById = Object.fromEntries(VEHICLES.map((vehicle) => [vehicle.id, vehicle])) as Record<
  TVehicleId,
  TVehicleDef
>;

/** Возвращает описание машины или undefined */
export const getVehicle = (id: string): TVehicleDef | undefined =>
  vehicleById[id as TVehicleId];

/** Проверяет, что строка — валидный id кузова */
export const isVehicleId = (value: string): value is TVehicleId => value in vehicleById;

import { DEFAULT_VEHICLE_ID, isVehicleId, type TVehicleId } from '@/entities/vehicle';
import { VEHICLE_STORAGE_KEY } from '@/shared/config';

/** Читает выбранный кузов из localStorage */
export const readSelectedVehicle = (): TVehicleId => {
  const stored = localStorage.getItem(VEHICLE_STORAGE_KEY);
  if (stored && isVehicleId(stored)) {
    return stored;
  }
  return DEFAULT_VEHICLE_ID;
};

/** Пишет выбранный кузов в localStorage */
export const persistSelectedVehicle = (vehicleId: TVehicleId): void => {
  localStorage.setItem(VEHICLE_STORAGE_KEY, vehicleId);
};

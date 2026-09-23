import { useState } from 'react';
import type { TVehicleId } from '@/entities/vehicle';
import { persistSelectedVehicle, readSelectedVehicle } from './model';

/** Выбранный кузов + запись в localStorage */
export const useSelectedVehicle = () => {
  const [vehicleId, setVehicleId] = useState<TVehicleId>(() => readSelectedVehicle());

  const selectVehicle = (next: TVehicleId) => {
    persistSelectedVehicle(next);
    setVehicleId(next);
  };

  return { vehicleId, selectVehicle };
};

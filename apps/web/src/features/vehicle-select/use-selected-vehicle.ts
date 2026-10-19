import { useState } from 'react';
import type { TVehicleId } from '@/entities/vehicle';
import { persistSelectedVehicle, readSelectedVehicle } from './model';

/** Selected body + write-through to localStorage */
export const useSelectedVehicle = () => {
  const [vehicleId, setVehicleId] = useState<TVehicleId>(() => readSelectedVehicle());

  const selectVehicle = (next: TVehicleId) => {
    persistSelectedVehicle(next);
    setVehicleId(next);
  };

  return { vehicleId, selectVehicle };
};

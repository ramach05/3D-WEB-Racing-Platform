import { beforeEach, describe, expect, it } from 'vitest';
import { VEHICLE_STORAGE_KEY } from '@/shared/config';
import { persistSelectedVehicle, readSelectedVehicle } from './model';

describe('vehicle-select model', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to hatchback', () => {
    expect(readSelectedVehicle()).toBe('hatchback');
  });

  it('persists and reads selection', () => {
    persistSelectedVehicle('pickup');
    expect(localStorage.getItem(VEHICLE_STORAGE_KEY)).toBe('pickup');
    expect(readSelectedVehicle()).toBe('pickup');
  });

  it('falls back on unknown value', () => {
    localStorage.setItem(VEHICLE_STORAGE_KEY, 'spaceship');
    expect(readSelectedVehicle()).toBe('hatchback');
  });
});

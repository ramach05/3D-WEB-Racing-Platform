import { describe, expect, it } from 'vitest';
import { getApiBaseUrl, LOCALE_STORAGE_KEY, THEME_STORAGE_KEY, VEHICLE_STORAGE_KEY } from './env';

describe('env', () => {
  it('returns api base url', () => {
    expect(getApiBaseUrl()).toMatch(/^https?:\/\//);
  });

  it('exposes storage keys', () => {
    expect(THEME_STORAGE_KEY).toBe('racing-theme');
    expect(LOCALE_STORAGE_KEY).toBe('racing-locale');
    expect(VEHICLE_STORAGE_KEY).toBe('racing-vehicle-v4');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CAMERA_MODE_ORDER,
  cycleCameraMode,
  getCameraMode,
  resetCameraMode,
  subscribeCameraMode,
} from './camera-mode';

describe('camera-mode', () => {
  afterEach(() => {
    resetCameraMode();
  });

  it('starts on chase', () => {
    expect(getCameraMode()).toBe('chase');
  });

  it('cycles through all modes and wraps to chase', () => {
    for (const expected of CAMERA_MODE_ORDER.slice(1)) {
      expect(cycleCameraMode()).toBe(expected);
    }
    expect(cycleCameraMode()).toBe('chase');
  });

  it('resetCameraMode returns to chase from any mode', () => {
    cycleCameraMode();
    cycleCameraMode();
    expect(getCameraMode()).toBe('tv');
    resetCameraMode();
    expect(getCameraMode()).toBe('chase');
  });

  it('notifies subscribers on cycle', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCameraMode(listener);
    cycleCameraMode();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

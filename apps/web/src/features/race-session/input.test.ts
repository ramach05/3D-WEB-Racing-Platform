import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindRaceInput, clearTouchAxes, getDriveInput, setTouchAxis } from './input';

describe('bindRaceInput', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearTouchAxes();
  });

  it('ignores auto-repeat keydown events', () => {
    const onRestart = vi.fn();
    const cleanup = bindRaceInput({
      onRestart,
      onTogglePause: vi.fn(),
      isRaceActive: () => true,
    });

    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyR', repeat: true, bubbles: true }),
    );

    expect(onRestart).not.toHaveBeenCalled();
    cleanup();
  });

  it('calls restart once on KeyR without repeat', () => {
    const onRestart = vi.fn();
    const cleanup = bindRaceInput({
      onRestart,
      onTogglePause: vi.fn(),
      isRaceActive: () => true,
    });

    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyR', repeat: false, bubbles: true }),
    );

    expect(onRestart).toHaveBeenCalledTimes(1);
    cleanup();
  });
});

describe('touch axes', () => {
  afterEach(() => {
    clearTouchAxes();
  });

  it('sets throttle and steer from touch flags', () => {
    setTouchAxis('throttle', true);
    expect(getDriveInput().throttle).toBe(1);

    setTouchAxis('steerLeft', true);
    expect(getDriveInput().steer).toBe(1);

    setTouchAxis('throttle', false);
    setTouchAxis('steerLeft', false);
    setTouchAxis('brake', true);
    setTouchAxis('steerRight', true);
    expect(getDriveInput()).toEqual({ throttle: 0, brake: 1, steer: -1 });
  });

  it('clears all touch axes', () => {
    setTouchAxis('throttle', true);
    setTouchAxis('steerLeft', true);
    clearTouchAxes();
    expect(getDriveInput()).toEqual({ throttle: 0, brake: 0, steer: 0 });
  });

  it('keeps touch axes after keyboard bind cleanup', () => {
    const cleanup = bindRaceInput({
      onRestart: vi.fn(),
      onTogglePause: vi.fn(),
      isRaceActive: () => true,
    });
    setTouchAxis('throttle', true);
    cleanup();
    expect(getDriveInput().throttle).toBe(1);
    clearTouchAxes();
  });
});

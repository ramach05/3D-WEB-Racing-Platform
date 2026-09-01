import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindRaceInput } from './input';

describe('bindRaceInput', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

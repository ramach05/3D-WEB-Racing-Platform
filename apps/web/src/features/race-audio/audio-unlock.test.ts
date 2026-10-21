import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachAudioUnlock } from './audio-unlock';

type TTestContext = {
  state: AudioContextState;
  resume: () => Promise<void>;
};

const makeCtx = (
  initial: AudioContextState,
): TTestContext & { resume: ReturnType<typeof vi.fn> } => {
  const ctx = {
    state: initial,
    resume: vi.fn(async () => {
      ctx.state = 'running';
    }),
  };
  return ctx;
};

const disposers: Array<() => void> = [];

afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose());
});

describe('attachAudioUnlock', () => {
  it('does nothing for a running context', async () => {
    const ctx = makeCtx('running');
    const onUnlock = vi.fn();
    const dispose = attachAudioUnlock(ctx, onUnlock);
    disposers.push(dispose);

    window.dispatchEvent(new KeyboardEvent('keydown'));
    await Promise.resolve();

    expect(ctx.resume).not.toHaveBeenCalled();
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('resumes and unlocks once on the first key gesture', async () => {
    const ctx = makeCtx('suspended');
    const onUnlock = vi.fn();
    const dispose = attachAudioUnlock(ctx, onUnlock);
    disposers.push(dispose);

    window.dispatchEvent(new KeyboardEvent('keydown'));
    await vi.waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1));

    window.dispatchEvent(new KeyboardEvent('keydown'));
    await Promise.resolve();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it('also unlocks on pointerdown', async () => {
    const ctx = makeCtx('suspended');
    const onUnlock = vi.fn();
    const dispose = attachAudioUnlock(ctx, onUnlock);
    disposers.push(dispose);

    window.dispatchEvent(new Event('pointerdown'));
    await vi.waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1));
  });

  it('ignores Esc keydown because it grants no user activation', async () => {
    const ctx = makeCtx('suspended');
    const onUnlock = vi.fn();
    const dispose = attachAudioUnlock(ctx, onUnlock);
    disposers.push(dispose);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await Promise.resolve();

    expect(ctx.resume).not.toHaveBeenCalled();
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('keeps listeners while resume rejects, then unlocks on the next gesture', async () => {
    const ctx = makeCtx('suspended');
    ctx.resume.mockRejectedValueOnce(new Error('NotAllowedError'));
    const onUnlock = vi.fn();
    const dispose = attachAudioUnlock(ctx, onUnlock);
    disposers.push(dispose);

    window.dispatchEvent(new KeyboardEvent('keydown'));
    await vi.waitFor(() => expect(ctx.resume).toHaveBeenCalledTimes(1));
    expect(onUnlock).not.toHaveBeenCalled();

    window.dispatchEvent(new KeyboardEvent('keydown'));
    await vi.waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1));
  });

  it('removes listeners on dispose', () => {
    const ctx = makeCtx('suspended');
    const onUnlock = vi.fn();
    const dispose = attachAudioUnlock(ctx, onUnlock);

    dispose();
    window.dispatchEvent(new KeyboardEvent('keydown'));

    expect(ctx.resume).not.toHaveBeenCalled();
    expect(onUnlock).not.toHaveBeenCalled();
  });
});

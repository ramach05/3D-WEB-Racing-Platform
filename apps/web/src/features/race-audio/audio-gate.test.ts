import { afterEach, describe, expect, it, vi } from 'vitest';

type TGateModule = {
  isAudioUnlocked: () => boolean;
  watchAudioGate: (onAwaitingChange: (awaiting: boolean) => void) => () => void;
};

const loadGate = async (): Promise<TGateModule> => {
  vi.resetModules();
  return await import('./audio-gate');
};

class FakeAudioContext {
  static initialState: AudioContextState = 'suspended';

  state: AudioContextState = FakeAudioContext.initialState;

  resume = vi.fn(async () => {
    this.state = 'running';
  });

  close = vi.fn(async () => {
    this.state = 'closed';
  });
}

let cancel: (() => void) | null = null;

afterEach(() => {
  cancel?.();
  cancel = null;
  vi.unstubAllGlobals();
  FakeAudioContext.initialState = 'suspended';
});

describe('watchAudioGate', () => {
  it('unlocks immediately when the context starts running (sticky activation)', async () => {
    FakeAudioContext.initialState = 'running';
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const gate = await loadGate();
    const onAwaitingChange = vi.fn();

    cancel = gate.watchAudioGate(onAwaitingChange);
    await Promise.resolve();

    expect(gate.isAudioUnlocked()).toBe(true);
    expect(onAwaitingChange).not.toHaveBeenCalled();
  });

  it('unlocks when resume resolves without a gesture', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const gate = await loadGate();
    const onAwaitingChange = vi.fn();

    cancel = gate.watchAudioGate(onAwaitingChange);
    await vi.waitFor(() => expect(gate.isAudioUnlocked()).toBe(true));

    expect(onAwaitingChange).not.toHaveBeenCalled();
  });

  it('reports awaiting while blocked and unlocks on the first key press', async () => {
    class BlockedAudioContext extends FakeAudioContext {
      override resume = vi.fn((): Promise<void> => new Promise<void>(() => undefined));
    }
    vi.stubGlobal('AudioContext', BlockedAudioContext);
    const gate = await loadGate();
    const onAwaitingChange = vi.fn();

    cancel = gate.watchAudioGate(onAwaitingChange);
    await vi.waitFor(() => expect(onAwaitingChange).toHaveBeenCalledWith(true));
    expect(gate.isAudioUnlocked()).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(gate.isAudioUnlocked()).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keydown'));
    expect(onAwaitingChange).toHaveBeenCalledWith(false);
    expect(gate.isAudioUnlocked()).toBe(true);
  });

  it('treats a missing AudioContext as allowed', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const gate = await loadGate();
    const onAwaitingChange = vi.fn();

    cancel = gate.watchAudioGate(onAwaitingChange);
    await Promise.resolve();

    expect(gate.isAudioUnlocked()).toBe(true);
    expect(onAwaitingChange).not.toHaveBeenCalled();
  });

  it('stops listening after cancel', async () => {
    class BlockedAudioContext extends FakeAudioContext {
      override resume = vi.fn((): Promise<void> => new Promise<void>(() => undefined));
    }
    vi.stubGlobal('AudioContext', BlockedAudioContext);
    const gate = await loadGate();
    const onAwaitingChange = vi.fn();

    const cancelFn = gate.watchAudioGate(onAwaitingChange);
    await vi.waitFor(() => expect(onAwaitingChange).toHaveBeenCalledWith(true));
    cancelFn();

    window.dispatchEvent(new KeyboardEvent('keydown'));
    expect(gate.isAudioUnlocked()).toBe(false);
  });
});

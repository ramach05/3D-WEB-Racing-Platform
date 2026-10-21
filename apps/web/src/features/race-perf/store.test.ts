import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('race perf store', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('computes fps and cpu after sample window', async () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { getRacePerfSnapshot, tickFrame } = await import('./store');
    tickFrame(10);

    now = 1250;
    tickFrame(40);

    const snap = getRacePerfSnapshot();
    expect(snap.fps).toBe(8);
    expect(snap.cpuPercent).toBe(20);
  });

  it('notifies subscribers after sample', async () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { subscribeRacePerf, tickFrame } = await import('./store');
    const listener = vi.fn();
    const unsubscribe = subscribeRacePerf(listener);
    tickFrame(5);

    now = 1250;
    tickFrame(5);

    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('throttles subscriber notify to 250ms', async () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { subscribeRacePerf, tickFrame } = await import('./store');
    const listener = vi.fn();
    subscribeRacePerf(listener);
    tickFrame(1);
    now = 1250;
    tickFrame(1);
    expect(listener).toHaveBeenCalledTimes(1);
    listener.mockClear();

    now = 1400;
    tickFrame(1);

    expect(listener).not.toHaveBeenCalled();

    now = 1500;
    tickFrame(1);

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

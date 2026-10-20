/** How long to wait for resume() before treating autoplay as blocked */
const PROBE_TIMEOUT_MS = 150;

const GESTURE_OPTIONS: AddEventListenerOptions = { capture: true };

let unlocked = false;

/** Whether audio may start playing in this document (autoplay allowed or a gesture already happened) */
export const isAudioUnlocked = (): boolean => unlocked;

/** Probes whether the browser allows audio without a gesture. */
export const watchAudioGate = (onAwaitingChange: (awaiting: boolean) => void): (() => void) => {
  if (unlocked) {
    return () => undefined;
  }

  let cancelled = false;
  let ctx: AudioContext | null = null;

  const closeProbe = (): void => {
    if (ctx && ctx.state !== 'closed') {
      void ctx.close().catch(() => undefined);
    }
    ctx = null;
  };

  const onGesture = (event: Event): void => {
    // Esc does not grant user activation in Chrome: it would not allow audio either
    if (event instanceof KeyboardEvent && event.key === 'Escape') {
      return;
    }
    unlocked = true;
    onAwaitingChange(false);
    window.removeEventListener('pointerdown', onGesture, GESTURE_OPTIONS);
    window.removeEventListener('keydown', onGesture, GESTURE_OPTIONS);
    closeProbe();
  };

  const probe = async (): Promise<void> => {
    if (typeof AudioContext === 'undefined') {
      // No Web Audio in this environment (SSR/jsdom): nothing to gate on
      unlocked = true;
      return;
    }
    ctx = new AudioContext();
    // Read through a local: a readonly-property narrowing must not swallow the post-resume check
    const stateAtStart = ctx.state;
    if (stateAtStart === 'running') {
      unlocked = true;
      return;
    }
    const timeout = new Promise<void>((resolve) => {
      window.setTimeout(resolve, PROBE_TIMEOUT_MS);
    });
    // Chrome keeps the resume promise pending until activation, Safari rejects it: race with a timeout
    await Promise.race([ctx.resume().catch(() => undefined), timeout]);
    if (cancelled || unlocked || !ctx) {
      return;
    }
    if (ctx.state === 'running') {
      unlocked = true;
      return;
    }
    onAwaitingChange(true);
    window.addEventListener('pointerdown', onGesture, GESTURE_OPTIONS);
    window.addEventListener('keydown', onGesture, GESTURE_OPTIONS);
  };

  void probe();

  return (): void => {
    cancelled = true;
    window.removeEventListener('pointerdown', onGesture, GESTURE_OPTIONS);
    window.removeEventListener('keydown', onGesture, GESTURE_OPTIONS);
    closeProbe();
  };
};

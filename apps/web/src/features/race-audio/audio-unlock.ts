type TUnlockableAudioContext = Pick<AudioContext, 'state'> & {
  /** Resume attempt; may reject or stay pending until the browser allows playback */
  resume: () => Promise<void>;
};

const GESTURE_OPTIONS: AddEventListenerOptions = { capture: true };

/** Resumes a blocked AudioContext on the first pointer/key gesture and calls onUnlock. */
export const attachAudioUnlock = (
  ctx: TUnlockableAudioContext,
  onUnlock: () => void,
): (() => void) => {
  if (ctx.state === 'running') {
    return () => undefined;
  }

  const onGesture = (event: Event): void => {
    // Esc does not grant user activation in Chrome: resuming would silently fail
    if (event instanceof KeyboardEvent && event.key === 'Escape') {
      return;
    }
    ctx
      .resume()
      .then(() => {
        if (ctx.state !== 'running') {
          return;
        }
        window.removeEventListener('pointerdown', onGesture, GESTURE_OPTIONS);
        window.removeEventListener('keydown', onGesture, GESTURE_OPTIONS);
        onUnlock();
      })
      .catch(() => {
        /* still blocked: the next gesture retries */
      });
  };

  window.addEventListener('pointerdown', onGesture, GESTURE_OPTIONS);
  window.addEventListener('keydown', onGesture, GESTURE_OPTIONS);

  return (): void => {
    window.removeEventListener('pointerdown', onGesture, GESTURE_OPTIONS);
    window.removeEventListener('keydown', onGesture, GESTURE_OPTIONS);
  };
};

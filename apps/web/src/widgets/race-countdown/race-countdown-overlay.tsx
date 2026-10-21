import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  setCountdownStep,
  startRacing,
  useRaceHudSelector,
  type TCountdownStep,
} from '@/features/race-session';

const STEP_MS = 750;
const GO_MS = 550;
const STEPS: TCountdownStep[] = [3, 2, 1, 0];

/** Checks the browser's prefers-reduced-motion */
const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/** Big SEGA 3-2-1-GO countdown before the timer starts */
export const RaceCountdownOverlay = () => {
  const { t } = useTranslation();
  const status = useRaceHudSelector((snapshot) => snapshot.status);
  const countdownStep = useRaceHudSelector((snapshot) => snapshot.countdownStep);

  // Runs the 3-2-1-GO step timers and starts the race.
  useEffect(() => {
    if (status !== 'countdown') {
      return;
    }

    const timers: number[] = [];

    if (prefersReducedMotion()) {
      setCountdownStep(0);
      timers.push(
        window.setTimeout(() => {
          startRacing();
        }, 200),
      );
      return () => {
        timers.forEach((id) => window.clearTimeout(id));
      };
    }

    let elapsed = 0;
    STEPS.forEach((step, index) => {
      const delay = elapsed;
      timers.push(
        window.setTimeout(() => {
          setCountdownStep(step);
          if (step === 0) {
            timers.push(
              window.setTimeout(() => {
                startRacing();
              }, GO_MS),
            );
          }
        }, delay),
      );
      elapsed += index < STEPS.length - 1 ? STEP_MS : 0;
    });

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [status]);

  if (status !== 'countdown' || countdownStep === null) {
    return null;
  }

  const label = countdownStep === 0 ? t('race.countdownGo') : String(countdownStep);

  return (
    <div
      className="sega-countdown pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
      role="status"
      aria-live="assertive"
      aria-atomic="true"
    >
      <p
        key={countdownStep}
        className={`sega-countdown__digit ${countdownStep === 0 ? 'sega-countdown__digit--go' : ''}`}
      >
        {label}
      </p>
    </div>
  );
};

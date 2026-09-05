import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  setCountdownStep,
  startRacing,
  useRaceHud,
  type CountdownStep,
} from '@/features/race-session';

const STEP_MS = 750;
const GO_MS = 550;
const STEPS: CountdownStep[] = [3, 2, 1, 0];

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/** Крупный SEGA-отсчёт 3-2-1-GO перед стартом таймера */
export const RaceCountdownOverlay = () => {
  const { t } = useTranslation();
  const hud = useRaceHud();

  useEffect(() => {
    if (hud.status !== 'countdown') {
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
  }, [hud.status]);

  if (hud.status !== 'countdown' || hud.countdownStep === null) {
    return null;
  }

  const label = hud.countdownStep === 0 ? t('race.countdownGo') : String(hud.countdownStep);

  return (
    <div
      className="sega-countdown pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
      role="status"
      aria-live="assertive"
      aria-atomic="true"
    >
      <p
        key={hud.countdownStep}
        className={`sega-countdown__digit ${hud.countdownStep === 0 ? 'sega-countdown__digit--go' : ''}`}
      >
        {label}
      </p>
    </div>
  );
};

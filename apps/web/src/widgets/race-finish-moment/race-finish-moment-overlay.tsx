import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRaceHudSelector } from '@/features/race-session';
import { formatRaceTime } from '@/shared/lib';

type TFinishMomentPhase = 'finish' | 'time';

type TRaceFinishMomentOverlayProps = {
  /** Показывать момент (до модалки результатов) */
  active: boolean;
  /** Время заезда, мс */
  timeMs: number;
  /** Новый личный рекорд */
  isNewBest: boolean;
};

const FINISH_PHASE_MS = 1800;

/** SEGA-момент финиша: FINISH! → время (и NEW BEST) перед модалкой результатов */
export const RaceFinishMomentOverlay = ({
  active,
  timeMs,
  isNewBest,
}: TRaceFinishMomentOverlayProps) => {
  const { t } = useTranslation();
  const status = useRaceHudSelector((snapshot) => snapshot.status);
  const visible = active && status === 'finished';
  const [phase, setPhase] = useState<TFinishMomentPhase>('finish');
  const [wasVisible, setWasVisible] = useState(false);

  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setPhase('finish');
    }
  }

  // После фазы FINISH! переключает на показ времени.
  useEffect(() => {
    if (!visible) {
      return;
    }
    const id = window.setTimeout(() => {
      setPhase('time');
    }, FINISH_PHASE_MS);
    return () => window.clearTimeout(id);
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="sega-finish-moment pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
      role="status"
      aria-live="assertive"
      aria-atomic="true"
    >
      {phase === 'finish' ? (
        <>
          <div key="wipe" className="sega-finish-moment__wipe" aria-hidden="true" />
          <p key="finish" className="sega-finish-moment__title">
            {t('race.finishMoment')}
          </p>
        </>
      ) : (
        <div key="time" className="sega-finish-moment__time-block">
          <p className="sega-finish-moment__time">{formatRaceTime(timeMs)}</p>
          {isNewBest ? (
            <p className="sega-finish-moment__new-best">{t('race.finishNewBest')}</p>
          ) : null}
        </div>
      )}
    </div>
  );
};

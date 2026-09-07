import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { type CountdownStep, type RaceStatus, useRaceHud } from '@/features/race-session';
import { formatRaceTime } from '@/shared/lib';

const getStatusLabel = (
  status: RaceStatus,
  countdownStep: CountdownStep | null,
  t: TFunction,
): string => {
  switch (status) {
    case 'ready':
      return t('race.ready');
    case 'countdown':
      return countdownStep === 0 ? t('race.countdownGo') : String(countdownStep ?? '');
    case 'racing':
      return t('race.racing');
    case 'paused':
      return t('race.paused');
    case 'finished':
      return t('race.finished');
  }
};

/** Текстовый HUD поверх канваса. Обновляется с троттлингом из vanilla-store. */
export const RaceHud = () => {
  const { t } = useTranslation();
  const hud = useRaceHud();
  const statusLabel = getStatusLabel(hud.status, hud.countdownStep, t);

  return (
    <div
      className="sega-panel bg-black/70 px-4 py-3 text-sm text-[var(--sega-yellow)]"
      aria-live="polite"
      aria-atomic="true"
    >
      <p>
        {t('race.status')}: {statusLabel}
      </p>
      <p>
        {t('race.time')}: {formatRaceTime(hud.timeMs)}
      </p>
      <p>
        {t('race.best')}: {hud.bestMs === null ? '—' : formatRaceTime(hud.bestMs)}
      </p>
      <p>
        {Math.round(hud.speedKmh)} km/h · {t('race.lap')}: {hud.lapIndex}/{hud.lapTotal}
      </p>
    </div>
  );
};

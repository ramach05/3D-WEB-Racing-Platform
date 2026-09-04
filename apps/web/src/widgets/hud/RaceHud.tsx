import { useTranslation } from 'react-i18next';
import { useRaceHud } from '@/features/race-session';
import { formatRaceTime } from '@/shared/lib';

/** Текстовый HUD поверх канваса. Обновляется с троттлингом из vanilla-store. */
export const RaceHud = () => {
  const { t } = useTranslation();
  const hud = useRaceHud();
  const statusLabel =
    hud.status === 'ready'
      ? t('race.ready')
      : hud.status === 'racing'
        ? t('race.racing')
        : hud.status === 'paused'
          ? t('race.paused')
          : t('race.finished');

  return (
    <div
      className="sega-panel bg-black/70 px-4 py-3 text-sm text-[var(--sega-yellow)]"
      aria-live="polite"
      aria-atomic="true"
    >
      <p>
        {t('race.status')}: {statusLabel}
      </p>
      <p className="font-mono">
        {t('race.time')}: {formatRaceTime(hud.timeMs)}
      </p>
      <p className="font-mono">
        {t('race.best')}: {hud.bestMs === null ? '—' : formatRaceTime(hud.bestMs)}
      </p>
      <p className="font-mono">
        {Math.round(hud.speedKmh)} km/h · {t('race.lap')}: {hud.lapIndex}/{hud.lapTotal}
      </p>
    </div>
  );
};

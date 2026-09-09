import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { type TCountdownStep, type TRaceStatus, useRaceHud } from '@/features/race-session';
import { formatRaceTime } from '@/shared/lib';

/** Ширина слота времени `mm:ss.hs` */
const TIME_SLOT_CH = 8;
/** Скорость до 999 km/h */
const SPEED_SLOT_CH = 3;
/** Запас к `ch` для пропорционального/кириллического шрифта */
const CH_PAD = 2;

/** Локализованная подпись статуса заезда для HUD */
const getStatusLabel = (
  status: TRaceStatus,
  countdownStep: TCountdownStep | null,
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

/** Макс. длина слота статуса для текущей локали (чтобы панель не сужалась) */
const getStatusSlotCh = (t: TFunction): number =>
  Math.max(
    t('race.ready').length,
    t('race.racing').length,
    t('race.paused').length,
    t('race.finished').length,
    t('race.countdownGo').length,
    1,
  );

/** Макс. длина подписей строк HUD для текущей локали */
const getLabelSlotCh = (t: TFunction): number =>
  Math.max(
    t('race.track').length,
    t('race.status').length,
    t('race.time').length,
    t('race.best').length,
    t('race.speed').length,
    t('race.lap').length,
  ) + 1;

type TRaceHudProps = {
  /** Название текущей трассы */
  trackName: string;
};

/** Текстовый HUD поверх канваса. Обновляется с троттлингом из vanilla-store. */
export const RaceHud = ({ trackName }: TRaceHudProps) => {
  const { t } = useTranslation();
  const hud = useRaceHud();
  const statusLabel = getStatusLabel(hud.status, hud.countdownStep, t);
  const labelSlotCh = getLabelSlotCh(t);
  const statusSlotCh = getStatusSlotCh(t);
  const lapDigits = Math.max(1, String(hud.lapTotal).length);
  const lapValueCh = lapDigits * 2 + 1;
  const speedValueCh = SPEED_SLOT_CH + ' km/h'.length;
  const panelMinCh =
    Math.max(
      labelSlotCh +
        1 +
        Math.max(trackName.length, statusSlotCh, TIME_SLOT_CH, speedValueCh, lapValueCh),
    ) + CH_PAD;

  return (
    <div
      className="sega-race-hud sega-panel bg-black/70 px-4 py-3 text-sm text-[var(--sega-yellow)]"
      style={{ minWidth: `${panelMinCh}ch` }}
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="sega-race-hud__row">
        <span className="sega-race-hud__label" style={{ minWidth: `${labelSlotCh}ch` }}>
          {t('race.track')}:
        </span>
        <span className="sega-race-hud__value">{trackName}</span>
      </p>
      <p className="sega-race-hud__row">
        <span className="sega-race-hud__label" style={{ minWidth: `${labelSlotCh}ch` }}>
          {t('race.status')}:
        </span>
        <span className="sega-race-hud__value" style={{ minWidth: `${statusSlotCh}ch` }}>
          {statusLabel}
        </span>
      </p>
      <p className="sega-race-hud__row">
        <span className="sega-race-hud__label" style={{ minWidth: `${labelSlotCh}ch` }}>
          {t('race.time')}:
        </span>
        <span className="sega-race-hud__value" style={{ minWidth: `${TIME_SLOT_CH}ch` }}>
          {formatRaceTime(hud.timeMs)}
        </span>
      </p>
      <p className="sega-race-hud__row">
        <span className="sega-race-hud__label" style={{ minWidth: `${labelSlotCh}ch` }}>
          {t('race.best')}:
        </span>
        <span className="sega-race-hud__value" style={{ minWidth: `${TIME_SLOT_CH}ch` }}>
          {hud.bestMs === null ? '—' : formatRaceTime(hud.bestMs)}
        </span>
      </p>
      <p className="sega-race-hud__row">
        <span className="sega-race-hud__label" style={{ minWidth: `${labelSlotCh}ch` }}>
          {t('race.speed')}:
        </span>
        <span
          className="sega-race-hud__value sega-race-hud__value--end"
          style={{ minWidth: `${SPEED_SLOT_CH}ch` }}
        >
          {Math.round(hud.speedKmh)}
        </span>
        <span>km/h</span>
      </p>
      <p className="sega-race-hud__row">
        <span className="sega-race-hud__label" style={{ minWidth: `${labelSlotCh}ch` }}>
          {t('race.lap')}:
        </span>
        <span className="sega-race-hud__value" style={{ minWidth: `${lapValueCh}ch` }}>
          {hud.lapIndex}/{hud.lapTotal}
        </span>
      </p>
    </div>
  );
};

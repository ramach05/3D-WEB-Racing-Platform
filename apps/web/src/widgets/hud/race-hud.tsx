import { useEffect, useRef } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  getRaceHudSnapshot,
  useRaceHudSelector,
  type TCountdownStep,
  type TRaceStatus,
} from '@/features/race-session';
import { formatRaceTime } from '@/shared/lib';

/** Width of the `mm:ss.hs` time slot */
const TIME_SLOT_CH = 8;
/** Speed up to 999 km/h */
const SPEED_SLOT_CH = 3;
/** Padding on `ch` for proportional/Cyrillic fonts */
const CH_PAD = 2;

/** Localized race status label for the HUD */
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

/** Max status slot length for the current locale (so the panel does not shrink) */
const getStatusSlotCh = (t: TFunction): number =>
  Math.max(
    t('race.ready').length,
    t('race.racing').length,
    t('race.paused').length,
    t('race.finished').length,
    t('race.countdownGo').length,
    1,
  );

/** Max HUD row label length for the current locale */
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
  /** Name of the current track */
  trackName: string;
  /** Track record from the leaderboard (#1), ms */
  bestMs?: number | null;
};

/** Text HUD over the canvas. Time/speed update via rAF without React rerenders. */
export const RaceHud = ({ trackName, bestMs = null }: TRaceHudProps) => {
  const { t } = useTranslation();
  const status = useRaceHudSelector((snapshot) => snapshot.status);
  const countdownStep = useRaceHudSelector((snapshot) => snapshot.countdownStep);
  const lapIndex = useRaceHudSelector((snapshot) => snapshot.lapIndex);
  const lapTotal = useRaceHudSelector((snapshot) => snapshot.lapTotal);
  const timeRef = useRef<HTMLSpanElement>(null);
  const speedRef = useRef<HTMLSpanElement>(null);
  const statusLabel = getStatusLabel(status, countdownStep, t);
  const labelSlotCh = getLabelSlotCh(t);
  const statusSlotCh = getStatusSlotCh(t);
  const lapDigits = Math.max(1, String(lapTotal).length);
  const lapValueCh = lapDigits * 2 + 1;
  const speedValueCh = SPEED_SLOT_CH + ' km/h'.length;
  const panelMinCh =
    Math.max(
      labelSlotCh +
        1 +
        Math.max(trackName.length, statusSlotCh, TIME_SLOT_CH, speedValueCh, lapValueCh),
    ) + CH_PAD;

  // Writes time/speed into the DOM without React — otherwise Chrome jerks the whole page ~12 Hz.
  useEffect(() => {
    let raf = 0;
    let lastTimeText = '';
    let lastSpeedText = '';

    const sync = () => {
      const snapshot = getRaceHudSnapshot();
      const timeText = formatRaceTime(snapshot.timeMs);
      const speedText = String(Math.round(snapshot.speedKmh));
      if (timeRef.current && timeText !== lastTimeText) {
        timeRef.current.textContent = timeText;
        lastTimeText = timeText;
      }
      if (speedRef.current && speedText !== lastSpeedText) {
        speedRef.current.textContent = speedText;
        lastSpeedText = speedText;
      }
      raf = requestAnimationFrame(sync);
    };

    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="sega-race-hud sega-panel sega-panel--overlay px-4 py-3 text-sm text-[var(--sega-yellow)]"
      style={{ minWidth: `min(${panelMinCh}ch, 100%)`, maxWidth: '100%' }}
    >
      <p className="sega-race-hud__row">
        <span className="sega-race-hud__label" style={{ minWidth: `${labelSlotCh}ch` }}>
          {t('race.track')}:
        </span>
        <span className="sega-race-hud__value">{trackName}</span>
      </p>
      {/* Countdown is announced by the assertive overlay; keep the HUD row quiet to avoid double speech */}
      <p className="sega-race-hud__row" aria-live={status === 'countdown' ? 'off' : 'polite'}>
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
        <span
          ref={timeRef}
          className="sega-race-hud__value"
          style={{ minWidth: `${TIME_SLOT_CH}ch` }}
        >
          {formatRaceTime(getRaceHudSnapshot().timeMs)}
        </span>
      </p>
      <p className="sega-race-hud__row">
        <span className="sega-race-hud__label" style={{ minWidth: `${labelSlotCh}ch` }}>
          {t('race.best')}:
        </span>
        <span className="sega-race-hud__value" style={{ minWidth: `${TIME_SLOT_CH}ch` }}>
          {bestMs === null ? '—' : formatRaceTime(bestMs)}
        </span>
      </p>
      <p className="sega-race-hud__row">
        <span className="sega-race-hud__label" style={{ minWidth: `${labelSlotCh}ch` }}>
          {t('race.speed')}:
        </span>
        <span
          ref={speedRef}
          className="sega-race-hud__value sega-race-hud__value--end"
          style={{ minWidth: `${SPEED_SLOT_CH}ch` }}
        >
          {Math.round(getRaceHudSnapshot().speedKmh)}
        </span>
        <span>km/h</span>
      </p>
      <p className="sega-race-hud__row">
        <span className="sega-race-hud__label" style={{ minWidth: `${labelSlotCh}ch` }}>
          {t('race.lap')}:
        </span>
        <span className="sega-race-hud__value" style={{ minWidth: `${lapValueCh}ch` }}>
          {lapIndex}/{lapTotal}
        </span>
      </p>
    </div>
  );
};

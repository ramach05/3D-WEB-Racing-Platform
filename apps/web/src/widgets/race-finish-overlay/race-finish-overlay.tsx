import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatRaceTime } from '@/shared/lib';
import { Button } from '@/shared/ui';
import type { TFinishSubmitState } from './race-finish-overlay.types';

type TRaceFinishOverlayProps = {
  /** Показать оверлей */
  open: boolean;
  /** Название трассы */
  trackName: string;
  /** Время заезда, мс */
  timeMs: number;
  /** Лучшее время, мс */
  bestMs: number | null;
  /** Новый личный рекорд */
  isNewBest: boolean;
  /** Гость без сохранения результата */
  isGuest: boolean;
  /** Статус отправки результата */
  submitState: TFinishSubmitState;
  /** Rank текущего игрока (считается на page) */
  userRank?: number | null;
  /** Слот таблицы лидеров — композиция со слоя pages */
  leaderboardSlot?: ReactNode;
  /** Рестарт заезда */
  onRestart: () => void;
  /** Выход к списку трасс */
  onExit: () => void;
  /** Открыть полный лидерборд */
  onOpenLeaderboard: () => void;
};

/** Celebratory overlay после финиша: время, рекорд, топ лидеров и действия */
export const RaceFinishOverlay = ({
  open,
  trackName,
  timeMs,
  bestMs,
  isNewBest,
  isGuest,
  submitState,
  userRank = null,
  leaderboardSlot,
  onRestart,
  onExit,
  onOpenLeaderboard,
}: TRaceFinishOverlayProps) => {
  const { t } = useTranslation();
  const firstButton = useRef<HTMLButtonElement>(null);

  // Фокус на первую кнопку при открытии оверлея.
  useEffect(() => {
    if (open) {
      firstButton.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="sega-finish-overlay absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="finish-title"
    >
      <div className="sega-finish-confetti" aria-hidden="true">
        <span className="sega-finish-confetti__piece sega-finish-confetti__piece--1" />
        <span className="sega-finish-confetti__piece sega-finish-confetti__piece--2" />
        <span className="sega-finish-confetti__piece sega-finish-confetti__piece--3" />
        <span className="sega-finish-confetti__piece sega-finish-confetti__piece--4" />
        <span className="sega-finish-confetti__piece sega-finish-confetti__piece--5" />
        <span className="sega-finish-confetti__piece sega-finish-confetti__piece--6" />
      </div>
      <div className="sega-panel relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 text-[var(--fg)]">
        <p className="text-xs uppercase tracking-widest text-[var(--sega-cyan)]">{trackName}</p>
        <h2
          id="finish-title"
          className="sega-finish-title mt-1 text-3xl font-semibold uppercase text-[var(--sega-yellow)]"
        >
          {t('race.finishTitle')}
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">{t('race.finishCongrats')}</p>

        <div className="mt-4 space-y-1 text-sm text-[var(--sega-yellow)]">
          <p>
            {t('race.time')}: {formatRaceTime(timeMs)}
          </p>
          <p>
            {t('race.best')}: {bestMs === null ? '—' : formatRaceTime(bestMs)}
          </p>
          {isNewBest ? (
            <p className="sega-blink uppercase text-[var(--sega-magenta)]">
              {t('race.newBest')}
            </p>
          ) : null}
        </div>

        {isGuest ? <p className="mt-3 text-xs text-[var(--muted)]">{t('race.guestHint')}</p> : null}

        {!isGuest && submitState === 'loading' ? (
          <p className="mt-3 text-sm text-[var(--sega-cyan)]" role="status" aria-live="polite">
            {t('race.savingResult')}
          </p>
        ) : null}

        {!isGuest && submitState === 'error' ? (
          <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
            {t('race.submitError')}
          </p>
        ) : null}

        {!isGuest && userRank !== null ? (
          <p className="mt-3 text-sm text-[var(--sega-cyan)]">
            {t('race.yourRank', { rank: userRank })}
          </p>
        ) : null}

        {!isGuest && leaderboardSlot ? (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-[var(--sega-yellow)]">
              {t('race.topResults')}
            </p>
            {leaderboardSlot}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-2">
          <Button ref={firstButton} onClick={onRestart}>
            {t('race.restart')}
          </Button>
          {!isGuest ? (
            <Button variant="ghost" onClick={onOpenLeaderboard}>
              {t('race.viewLeaderboard')}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onExit}>
            {t('race.toTracks')}
          </Button>
        </div>
      </div>
    </div>
  );
};

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useBackendStatus } from '@/features/backend-status';
import { racingApi } from '@/shared/api';
import { SegaLoader, SegaSkeleton } from '@/shared/ui';

/** Через сколько ожидания старта показывать подсказку */
const HINT_DELAY_MS = 8_000;

type TDelayedHintProps = {
  /** Текст подсказки */
  text: string;
  /** Задержка появления */
  delayMs: number;
};

/** Подсказка, появляющаяся только если ожидание затянулось */
const DelayedHint = ({ text, delayMs }: TDelayedHintProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [delayMs]);

  if (!visible) {
    return null;
  }
  return <p className="mt-5 text-sm text-[var(--muted)]">{text}</p>;
};

type TBackendGateProps = {
  /** Контент, который рендерится только при живом API */
  children: ReactNode;
};

/**
 * Гейт доступности API: до первого ответа /health вместо контента лоадер,
 * поэтому запросы страниц не падают на старте dev-скрипта.
 * При последующей потере связи контент остается смонтированным, сверху — плашка.
 */
export const BackendGate = ({ children }: TBackendGateProps) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const status = useBackendStatus();
  const wasReady = useRef(false);

  useEffect(() => {
    if (status !== 'ready') {
      return;
    }
    if (wasReady.current) {
      dispatch(racingApi.util.invalidateTags(['Track', 'Leaderboard', 'Me']));
    }
    wasReady.current = true;
  }, [status, dispatch]);

  if (status === 'booting') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--bg)] px-4">
        <div className="sega-panel w-full max-w-md p-6 text-center">
          <SegaLoader label={t('boot.waiting')} />
          <div className="mt-6 grid gap-2" aria-hidden="true">
            <SegaSkeleton className="sega-skeleton--inset h-4 w-full" />
            <SegaSkeleton className="sega-skeleton--inset h-4 w-4/5" />
            <SegaSkeleton className="sega-skeleton--inset h-4 w-3/5" />
          </div>
          <DelayedHint delayMs={HINT_DELAY_MS} text={t('boot.hint')} />
        </div>
      </div>
    );
  }

  return (
    <>
      {status === 'lost' ? (
        <p
          role="alert"
          className="sticky top-0 z-50 bg-[var(--sega-magenta)] px-4 py-2 text-center text-sm font-semibold uppercase text-[var(--bg)]"
        >
          {t('boot.lost')} — {t('boot.hintLost')}
        </p>
      ) : null}
      {children}
    </>
  );
};

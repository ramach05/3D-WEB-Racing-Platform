import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui';

type TRacePauseMenuProps = {
  /** Показать меню паузы */
  open: boolean;
  /** Продолжить заезд */
  onResume: () => void;
  /** Рестарт заезда */
  onRestart: () => void;
  /** Выход к списку трасс */
  onExit: () => void;
};

/** Модалка паузы: Esc, ловушка фокуса на кнопках */
export const RacePauseMenu = ({ open, onResume, onRestart, onExit }: TRacePauseMenuProps) => {
  const { t } = useTranslation();
  const firstButton = useRef<HTMLButtonElement>(null);

  // Фокус на первую кнопку при открытии паузы.
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
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
      onClick={onResume}
    >
      <div
        className="sega-panel w-full max-w-sm p-6 text-[var(--fg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pause-title" className="text-xl font-semibold uppercase text-[var(--sega-yellow)]">
          {t('race.paused')}
        </h2>
        <div className="mt-4 flex flex-col gap-2">
          <Button ref={firstButton} onClick={onResume}>
            {t('race.resume')}
          </Button>
          <Button variant="ghost" onClick={onRestart}>
            {t('race.restart')}
          </Button>
          <Button variant="ghost" onClick={onExit}>
            {t('race.toTracks')}
          </Button>
        </div>
      </div>
    </div>
  );
};

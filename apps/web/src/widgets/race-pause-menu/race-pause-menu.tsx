import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui';

type TRacePauseMenuProps = {
  /** Show the pause menu */
  open: boolean;
  /** Resume the race */
  onResume: () => void;
  /** Restart the race */
  onRestart: () => void;
  /** Exit to the track list */
  onExit: () => void;
};

/** Pause modal: Esc, focus trap on the buttons */
export const RacePauseMenu = ({ open, onResume, onRestart, onExit }: TRacePauseMenuProps) => {
  const { t } = useTranslation();
  const firstButton = useRef<HTMLButtonElement>(null);

  // Focus the first button when the pause opens.
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

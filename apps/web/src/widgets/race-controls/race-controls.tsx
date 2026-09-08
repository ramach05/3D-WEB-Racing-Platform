import { useTranslation } from 'react-i18next';

/** Постоянная панель горячих клавиш в левом нижнем углу */
export const RaceControls = () => {
  const { t } = useTranslation();

  return (
    <div
      className="pointer-events-none absolute bottom-4 left-4 z-10 max-w-xs"
      aria-label={t('race.controlsTitle')}
    >
      <div className="sega-panel !bg-black/75 px-3 py-2 text-xs text-[var(--sega-cyan)]">
        <p className="mb-1 uppercase text-[var(--sega-yellow)]">{t('race.controlsTitle')}</p>
        <ul className="grid gap-0.5">
          <li>{t('home.throttle')}</li>
          <li>{t('home.brake')}</li>
          <li>{t('home.steer')}</li>
          <li>{t('home.restart')}</li>
          <li>{t('home.pause')}</li>
        </ul>
      </div>
    </div>
  );
};

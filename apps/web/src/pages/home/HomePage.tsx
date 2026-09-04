import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthUser } from '@/features/auth';
import { getAllTrackConfigs, TrackMinimap } from '@/entities/track';
import { PageShell } from '@/shared/ui';
import { RaceMarquee } from './RaceMarquee';

/** Лендинг в стиле SEGA title screen */
export const HomePage = () => {
  const { t } = useTranslation();
  const user = useAuthUser();
  const trackConfigs = getAllTrackConfigs();
  const marqueeItems = t('home.marqueeItems', { returnObjects: true });
  const marquee = Array.isArray(marqueeItems) ? `${marqueeItems.join(' ')} ` : '';

  return (
    <PageShell className="relative overflow-hidden">
      <div className="sega-scanlines pointer-events-none absolute inset-0" aria-hidden />
      <section className="sega-panel relative p-6 md:p-10">
        <p className="text-sm uppercase tracking-[0.3em] text-[var(--sega-cyan)]">
          {t('home.tagline')}
        </p>
        <h1 className="mt-2 text-4xl font-semibold uppercase text-[var(--sega-yellow)] md:text-6xl">
          {t('home.title')}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-[var(--muted)]">{t('home.subtitle')}</p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link to="/tracks" className="sega-btn sega-blink text-base">
            {t('home.pressStart')}
          </Link>
          {user ? null : (
            <>
              <Link to="/login" className="sega-btn sega-btn--ghost">
                {t('nav.login')}
              </Link>
              <Link to="/register" className="sega-btn sega-btn--ghost">
                {t('nav.register')}
              </Link>
            </>
          )}
        </div>

        <RaceMarquee text={marquee} />

        <h2 className="mt-10 text-xl uppercase text-[var(--sega-cyan)]">
          {t('home.featuredTracks')}
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {trackConfigs.map((config) => (
            <Link
              key={config.slug}
              to="/tracks"
              className="sega-panel sega-card-link block p-4 no-underline"
              aria-label={config.slug === 'coastal-oval' ? t('home.coastal') : t('home.nightCity')}
            >
              <h3 className="text-lg text-[var(--sega-yellow)]">
                {config.slug === 'coastal-oval' ? t('home.coastal') : t('home.nightCity')}
              </h3>
              <TrackMinimap
                config={config}
                className="mt-3 w-full border-2 border-[var(--border)]"
              />
            </Link>
          ))}
        </div>

        <section className="sega-panel mt-10 p-4" aria-labelledby="controls-heading">
          <h2 id="controls-heading" className="text-lg uppercase text-[var(--sega-magenta)]">
            {t('home.controlsTitle')}
          </h2>
          <ul className="mt-3 grid gap-1 text-[var(--muted)] sm:grid-cols-2">
            <li>{t('home.throttle')}</li>
            <li>{t('home.brake')}</li>
            <li>{t('home.steer')}</li>
            <li>{t('home.restart')}</li>
            <li>{t('home.pause')}</li>
          </ul>
        </section>
      </section>
    </PageShell>
  );
};

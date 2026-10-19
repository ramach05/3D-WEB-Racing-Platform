import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthHydrated, useAuthUser } from '@/features/auth';
import { getAllTrackConfigs } from '@/entities/track';
import { PageMeta, PageShell, SegaSkeleton } from '@/shared/ui';
import { TrackMinimap } from '@/widgets/track-minimap';
import { RaceMarquee } from './race-marquee';

const TRACK_NAME_MAP: Record<string, string> = {
  'coastal-oval': 'home.coastal',
  'night-city': 'home.nightCity',
  'storm-eight': 'home.stormEight',
};

/** Landing page styled after a SEGA title screen */
export const HomePage = () => {
  const { t } = useTranslation();
  const user = useAuthUser();
  const hydrated = useAuthHydrated();
  const trackConfigs = getAllTrackConfigs();
  const marqueeItems = t('home.marqueeItems', { returnObjects: true });
  const marquee = Array.isArray(marqueeItems) ? `${marqueeItems.join(' ')} ` : '';

  return (
    <PageShell>
      <PageMeta title={t('home.title')} />
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
          {user ? null : hydrated ? (
            <>
              <Link to="/login" className="sega-btn sega-btn--ghost">
                {t('nav.login')}
              </Link>
              <Link to="/register" className="sega-btn sega-btn--ghost">
                {t('nav.register')}
              </Link>
            </>
          ) : (
            <span role="status" aria-label={t('auth.loading')} className="flex items-center gap-4">
              <SegaSkeleton className="sega-skeleton--inset h-[2.6rem] w-24" />
              <SegaSkeleton className="sega-skeleton--inset h-[2.6rem] w-32" />
            </span>
          )}
        </div>

        <RaceMarquee text={marquee} />

        <h2 className="mt-10 text-xl uppercase text-[var(--sega-cyan)]">
          {t('home.featuredTracks')}
        </h2>
        <div className="mt-4 grid max-w-md gap-3 sm:grid-cols-2">
          {trackConfigs.map((config) => (
            <Link
              key={config.slug}
              to="/tracks"
              className="sega-panel sega-card-link flex items-center gap-3 p-2 no-underline"
              aria-label={t(TRACK_NAME_MAP[config.slug] ?? '')}
            >
              <TrackMinimap
                config={config}
                className="h-14 w-[5.5rem] shrink-0 border-2 border-[var(--border)]"
              />
              <h3 className="text-sm text-[var(--sega-yellow)]">
                {t(TRACK_NAME_MAP[config.slug] ?? '')}
              </h3>
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
            <li>{t('home.handbrake')}</li>
            <li>{t('home.steer')}</li>
            <li>{t('home.restart')}</li>
            <li>{t('home.pause')}</li>
            <li>{t('home.camera')}</li>
          </ul>
        </section>
      </section>
    </PageShell>
  );
};

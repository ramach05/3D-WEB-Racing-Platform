import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getTrackConfig, useGetTracksQuery } from '@/entities/track';
import { PageShell, StatusText, TracksPageSkeleton } from '@/shared/ui';
import { preloadVehicleModel } from '@/widgets/race-canvas';
import { TrackMinimap } from '@/widgets/track-minimap';

/** Track list from the API with top-down maps */
export const TracksPage = () => {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useGetTracksQuery();

  // Warms up the car GLB before entering the race.
  useEffect(() => {
    preloadVehicleModel();
  }, []);

  return (
    <PageShell className="lg:max-w-7xl">
      <h1 className="text-3xl font-semibold uppercase text-[var(--sega-yellow)]">
        {t('tracks.title')}
      </h1>
      {isLoading ? <TracksPageSkeleton /> : null}
      {isError ? <StatusText>{t('tracks.error')}</StatusText> : null}
      {data && data.length === 0 ? <StatusText>{t('tracks.empty')}</StatusText> : null}
      {data && data.length > 0 ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 sm:items-stretch lg:grid-cols-none lg:grid-flow-col lg:auto-cols-fr">
          {data.map((track) => {
            const config = getTrackConfig(track.slug);
            const body = (
              <>
                <h2 className="text-lg font-medium text-[var(--sega-cyan)]">{track.name}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {t(`tracks.descriptions.${track.slug}`, { defaultValue: '' })}
                </p>
                <div className="mt-auto pt-3">
                  {config ? (
                    <div>
                      <p className="text-xs uppercase text-[var(--muted)]">
                        {t('tracks.mapLabel')}
                      </p>
                      <TrackMinimap
                        config={config}
                        className="mt-2 w-full border-2 border-[var(--border)]"
                      />
                    </div>
                  ) : null}
                  {track.isAvailable ? (
                    <span className="sega-btn mt-4 inline-flex text-sm">{t('tracks.start')}</span>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--muted)]">{t('tracks.unavailable')}</p>
                  )}
                </div>
              </>
            );

            return (
              <li key={track.id} className="h-full">
                {track.isAvailable ? (
                  <Link
                    to={`/race/${track.slug}`}
                    className="sega-panel sega-card-link flex h-full flex-col p-4 no-underline"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="sega-panel flex h-full flex-col p-4">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </PageShell>
  );
};

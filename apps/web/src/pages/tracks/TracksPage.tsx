import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getTrackConfig, useGetTracksQuery } from '@/entities/track';
import { PageShell, StatusText } from '@/shared/ui';
import { TrackMinimap } from '@/widgets/track-minimap';

/** Список трасс с API и планом сверху */
export const TracksPage = () => {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useGetTracksQuery();

  return (
    <PageShell>
      <h1 className="text-3xl font-semibold uppercase text-[var(--sega-yellow)]">
        {t('tracks.title')}
      </h1>
      {isLoading ? <StatusText>{t('tracks.loading')}</StatusText> : null}
      {isError ? <StatusText>{t('tracks.error')}</StatusText> : null}
      {data && data.length === 0 ? <StatusText>{t('tracks.empty')}</StatusText> : null}
      {data && data.length > 0 ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 sm:items-stretch">
          {data.map((track) => {
            const config = getTrackConfig(track.slug);
            return (
              <li key={track.id} className="sega-panel flex h-full flex-col p-4">
                <h2 className="text-lg font-medium text-[var(--sega-cyan)]">{track.name}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {t(`tracks.descriptions.${track.slug}`, { defaultValue: '' })}
                </p>
                <div className="mt-auto pt-3">
                  {config ? (
                    <div>
                      <p className="text-xs uppercase text-[var(--muted)]">{t('tracks.mapLabel')}</p>
                      <TrackMinimap
                        config={config}
                        className="mt-2 w-full border-2 border-[var(--border)]"
                      />
                    </div>
                  ) : null}
                  {track.isAvailable ? (
                    <Link to={`/race/${track.id}`} className="sega-btn mt-4 inline-flex text-sm">
                      {t('tracks.start')}
                    </Link>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--muted)]">{t('tracks.unavailable')}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </PageShell>
  );
};

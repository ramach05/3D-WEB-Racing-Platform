import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetLeaderboardQuery } from '@/entities/leaderboard';
import { useGetTracksQuery } from '@/entities/track';
import { PageShell, StatusText } from '@/shared/ui';
import { LeaderboardTable } from '@/widgets/leaderboard-table';

/** Глобальная таблица лидеров с фильтром по трассе */
export const LeaderboardPage = () => {
  const { t } = useTranslation();
  const { data: tracks, isLoading: tracksLoading, isError: tracksError } = useGetTracksQuery();
  const [trackId, setTrackId] = useState<string>('');

  const selectedId = useMemo(() => {
    if (trackId) {
      return trackId;
    }
    return tracks?.[0]?.id ?? '';
  }, [trackId, tracks]);

  const { data, isLoading, isError } = useGetLeaderboardQuery(selectedId, { skip: !selectedId });

  return (
    <PageShell>
      <h1 className="text-3xl font-semibold uppercase text-[var(--sega-yellow)]">
        {t('leaderboard.title')}
      </h1>
      {tracksLoading ? <StatusText>{t('tracks.loading')}</StatusText> : null}
      {tracksError ? <StatusText>{t('tracks.error')}</StatusText> : null}
      {tracks && tracks.length > 0 ? (
        <label className="sega-field mt-4 max-w-sm">
          <span className="font-medium">{t('leaderboard.track')}</span>
          <select
            value={selectedId}
            onChange={(event) => setTrackId(event.target.value)}
            className="border-4 border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-[inherit]"
          >
            {tracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {isLoading ? <StatusText>{t('leaderboard.loading')}</StatusText> : null}
      {isError ? <StatusText>{t('leaderboard.error')}</StatusText> : null}
      {data && data.length === 0 ? <StatusText>{t('leaderboard.empty')}</StatusText> : null}
      {data && data.length > 0 ? <LeaderboardTable entries={data} /> : null}
    </PageShell>
  );
};

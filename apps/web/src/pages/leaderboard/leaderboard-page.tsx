import { type KeyboardEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetLeaderboardQuery } from '@/entities/leaderboard';
import { useGetTracksQuery } from '@/entities/track';
import { useAuthUser } from '@/features/auth';
import { cx } from '@/shared/lib';
import { PageShell, StatusText } from '@/shared/ui';
import { LeaderboardTable } from '@/widgets/leaderboard-table';

/** Глобальная таблица лидеров с фильтром по трассе */
export const LeaderboardPage = () => {
  const { t } = useTranslation();
  const user = useAuthUser();
  const { data: tracks, isLoading: tracksLoading, isError: tracksError } = useGetTracksQuery();
  const [trackSlug, setTrackSlug] = useState<string>('');

  const selectedSlug = useMemo(() => {
    if (trackSlug) {
      return trackSlug;
    }
    return tracks?.[0]?.slug ?? '';
  }, [trackSlug, tracks]);

  const { data, isLoading, isError } = useGetLeaderboardQuery(selectedSlug, {
    skip: !selectedSlug,
  });

  /** Переключение трассы стрелками / Home / End */
  const onTrackKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!tracks || tracks.length === 0) {
      return;
    }
    const currentIndex = tracks.findIndex((track) => track.slug === selectedSlug);
    if (currentIndex < 0) {
      return;
    }

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % tracks.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tracks.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const next = tracks[nextIndex];
    if (next) {
      setTrackSlug(next.slug);
      const tab = event.currentTarget.querySelector<HTMLElement>(`#leaderboard-track-${next.slug}`);
      tab?.focus();
    }
  };

  return (
    <PageShell>
      <h1 className="text-3xl font-semibold uppercase text-[var(--sega-yellow)]">
        {t('leaderboard.title')}
      </h1>
      {tracksLoading ? <StatusText>{t('tracks.loading')}</StatusText> : null}
      {tracksError ? <StatusText>{t('tracks.error')}</StatusText> : null}
      {tracks && tracks.length > 0 ? (
        <div className="mt-4">
          <p
            id="leaderboard-track-label"
            className="mb-2 text-sm font-medium uppercase text-[var(--muted)]"
          >
            {t('leaderboard.track')}
          </p>
          <div
            role="tablist"
            aria-labelledby="leaderboard-track-label"
            className="sega-track-tabs"
            onKeyDown={onTrackKeyDown}
          >
            {tracks.map((track) => {
              const selected = track.slug === selectedSlug;
              return (
                <button
                  key={track.slug}
                  id={`leaderboard-track-${track.slug}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  className={cx('sega-track-tab', selected && 'sega-track-tab--active')}
                  onClick={() => setTrackSlug(track.slug)}
                >
                  {track.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {isLoading ? <StatusText>{t('leaderboard.loading')}</StatusText> : null}
      {isError ? <StatusText>{t('leaderboard.error')}</StatusText> : null}
      {data && data.length === 0 ? <StatusText>{t('leaderboard.empty')}</StatusText> : null}
      {data && data.length > 0 ? (
        <LeaderboardTable entries={data} highlightUserId={user?.id} />
      ) : null}
    </PageShell>
  );
};

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TRACK_SLUGS } from '@racing/shared';
import type { TUserStats, TUserTrackStat } from '@racing/shared';
import { useAuthHydrated, useAuthUser, useGetMeQuery } from '@/features/auth';
import { getAchievements } from '@/entities/race-result';
import { cx, formatGap, formatRaceTime, readAuthSession } from '@/shared/lib';
import { PageMeta, PageShell, ProfilePageSkeleton, StatusText } from '@/shared/ui';

const StatsGrid = ({ stats }: { stats: TUserStats }) => {
  const { t } = useTranslation();
  const cards = [
    { key: 'races', value: String(stats.totalRaces) },
    { key: 'tracks', value: `${stats.tracksCompleted}/${TRACK_SLUGS.length}` },
    { key: 'totalTime', value: formatRaceTime(stats.totalTimeMs) },
  ] as const;

  // Phones: one card per row with label/value on one line; sm+: three cards in a row
  return (
    <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.key}
          className="sega-panel flex flex-wrap items-baseline justify-between gap-x-2 px-3 py-3"
        >
          <dt className="text-xs uppercase text-[var(--muted)]">
            {t(`profile.stats.${card.key}`)}
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-[var(--sega-yellow)] sm:text-xl">
            {card.value}
          </dd>
        </div>
      ))}
    </dl>
  );
};

const TrackStatRow = ({ stat }: { stat: TUserTrackStat }) => {
  const { t } = useTranslation();

  return (
    <li className="sega-panel px-3 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{stat.trackName}</span>
        <span className="tabular-nums">{formatRaceTime(stat.bestTimeMs)}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
        <span>{t('profile.tracks.rank', { rank: stat.rank })}</span>
        <span>{t('profile.tracks.attempts', { total: stat.races })}</span>
        <span>{t('profile.tracks.total', { time: formatRaceTime(stat.totalTimeMs) })}</span>
        {stat.gapToLeaderMs === 0 ? (
          <span className="text-[var(--sega-yellow)]">{t('profile.tracks.leader')}</span>
        ) : (
          <span>{t('profile.tracks.gapToLeader', { gap: formatGap(stat.gapToLeaderMs) })}</span>
        )}
        {stat.improvementMs > 0 ? (
          <span className="text-[var(--sega-cyan)]">
            {t('profile.tracks.improved', { delta: formatGap(stat.improvementMs) })}
          </span>
        ) : null}
      </div>
    </li>
  );
};

const AchievementsGrid = ({ stats }: { stats: TUserStats }) => {
  const { t } = useTranslation();
  const achievements = getAchievements(stats);

  return (
    <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {achievements.map((achievement) => (
        <li
          key={achievement.id}
          className={cx('sega-panel px-3 py-2', !achievement.unlocked && 'opacity-50')}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={cx(
                'font-medium',
                achievement.unlocked ? 'text-[var(--sega-yellow)]' : 'text-[var(--muted)]',
              )}
            >
              {t(`achievements.items.${achievement.id}.title`)}
            </span>
            <span className="text-xs tabular-nums text-[var(--sega-cyan)]">
              {achievement.unlocked
                ? '★'
                : achievement.target > 1
                  ? `${achievement.progress}/${achievement.target}`
                  : ''}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {t(`achievements.items.${achievement.id}.description`)}
          </p>
        </li>
      ))}
    </ul>
  );
};

/** Account page: stats overview, per-track bests with rank/gap and achievements */
export const ProfilePage = () => {
  const { t } = useTranslation();
  const user = useAuthUser();
  const hydrated = useAuthHydrated();
  const hasAccess = Boolean(readAuthSession());
  const { data, isLoading, isError } = useGetMeQuery(undefined, { skip: !user && !hasAccess });

  if (!user && !hydrated) {
    return (
      <PageShell>
        <PageMeta title={t('profile.title')} />
        <h1 className="text-3xl font-semibold uppercase text-[var(--sega-yellow)]">
          {t('profile.title')}
        </h1>
        <ProfilePageSkeleton />
      </PageShell>
    );
  }

  if (!user && !isLoading) {
    return (
      <PageShell>
        <PageMeta title={t('profile.title')} />
        <h1 className="text-3xl font-semibold uppercase text-[var(--sega-yellow)]">
          {t('profile.title')}
        </h1>
        <StatusText>{t('profile.guest')}</StatusText>
        <Link to="/login" className="sega-btn sega-btn--ghost mt-4 inline-flex text-sm">
          {t('nav.login')}
        </Link>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageMeta title={t('profile.title')} />
      <h1 className="text-3xl font-semibold uppercase text-[var(--sega-yellow)]">
        {t('profile.title')}
      </h1>
      {isLoading ? <ProfilePageSkeleton /> : null}
      {isError ? <StatusText>{t('profile.error')}</StatusText> : null}
      {data ? (
        <>
          <p className="mt-3 text-[var(--sega-cyan)]">{data.user.nickname}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {t('profile.memberSince', {
              date: new Date(data.user.createdAt).toLocaleDateString(),
            })}
          </p>
          {data.stats.totalRaces > 0 ? (
            <>
              <h2 className="mt-8 text-xl font-medium uppercase text-[var(--sega-magenta)]">
                {t('profile.statsTitle')}
              </h2>
              <StatsGrid stats={data.stats} />
            </>
          ) : null}
          <h2 className="mt-8 text-xl font-medium uppercase text-[var(--sega-magenta)]">
            {t('profile.bestTimes')}
          </h2>
          {data.stats.perTrack.length === 0 ? (
            <StatusText>{t('profile.empty')}</StatusText>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.stats.perTrack.map((stat) => (
                <TrackStatRow key={stat.trackId} stat={stat} />
              ))}
            </ul>
          )}
          <h2 className="mt-8 text-xl font-medium uppercase text-[var(--sega-magenta)]">
            {t('achievements.title')}
          </h2>
          <AchievementsGrid stats={data.stats} />
        </>
      ) : null}
    </PageShell>
  );
};

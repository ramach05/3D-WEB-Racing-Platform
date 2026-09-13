import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthUser, useGetMeQuery } from '@/features/auth';
import { formatRaceTime, readAuthSession } from '@/shared/lib';
import { PageShell, ProfilePageSkeleton, StatusText } from '@/shared/ui';

/** Личный кабинет: профиль и лучшие времена */
export const ProfilePage = () => {
  const { t } = useTranslation();
  const user = useAuthUser();
  const hasSession = Boolean(readAuthSession());
  const { data, isLoading, isError } = useGetMeQuery(undefined, { skip: !user && !hasSession });

  if (!user && !isLoading) {
    return (
      <PageShell>
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
      <h1 className="text-3xl font-semibold uppercase text-[var(--sega-yellow)]">
        {t('profile.title')}
      </h1>
      {isLoading ? <ProfilePageSkeleton /> : null}
      {isError ? <StatusText>{t('profile.error')}</StatusText> : null}
      {data ? (
        <>
          <p className="mt-3 text-[var(--sega-cyan)]">{data.user.nickname}</p>
          <h2 className="mt-8 text-xl font-medium uppercase text-[var(--sega-magenta)]">
            {t('profile.bestTimes')}
          </h2>
          {data.bestResults.length === 0 ? (
            <StatusText>{t('profile.empty')}</StatusText>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.bestResults.map((row) => (
                <li
                  key={row.trackId}
                  className="sega-panel flex flex-wrap items-baseline justify-between gap-2 px-3 py-2"
                >
                  <span className="font-medium">{row.trackName}</span>
                  <span>{formatRaceTime(row.timeMs)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </PageShell>
  );
};

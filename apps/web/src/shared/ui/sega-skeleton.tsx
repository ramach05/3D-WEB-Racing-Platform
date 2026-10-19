import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TRACK_SLUGS } from '@racing/shared';
import { cx } from '@/shared/lib';

type TSegaSkeletonProps = {
  /** Доп. классы */
  className?: string;
  /** Инлайн-стили (размер) */
  style?: CSSProperties;
};

/** Пиксельный блок-заглушка со stepped-пульсацией */
export const SegaSkeleton = ({ className, style }: TSegaSkeletonProps) => {
  return <span aria-hidden="true" className={cx('sega-skeleton', className ?? '')} style={style} />;
};

type TSkeletonRegionProps = {
  /** Доступная подпись статуса */
  label: string;
  /** Содержимое скелетона */
  children: ReactNode;
  /** Доп. классы региона */
  className?: string;
};

/** Обертка скелетона с role=status */
const SkeletonRegion = ({ label, children, className }: TSkeletonRegionProps) => {
  return (
    <div role="status" aria-live="polite" aria-busy="true" aria-label={label} className={className}>
      {children}
    </div>
  );
};

type TTracksPageSkeletonProps = {
  /** Число ячеек-заглушек (по умолчанию = числу трасс) */
  count?: number;
};

/** Скелетон сетки карточек трасс (как TracksPage) */
export const TracksPageSkeleton = ({ count = TRACK_SLUGS.length }: TTracksPageSkeletonProps) => {
  const { t } = useTranslation();

  return (
    <SkeletonRegion label={t('tracks.loading')}>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 sm:items-stretch lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none">
        {Array.from({ length: count }, (_, index) => (
          <li key={index} className="h-full">
            <div className="sega-panel flex h-full flex-col p-4">
              {/* text-lg title ≈ Coastal Oval / Night City */}
              <SegaSkeleton className="sega-skeleton--inset h-7 w-[9.5rem]" />
              {/* text-sm description, ~4 строки в половине max-w-5xl */}
              <div className="mt-1 space-y-1.5">
                <SegaSkeleton className="sega-skeleton--inset h-3.5 w-full" />
                <SegaSkeleton className="sega-skeleton--inset h-3.5 w-full" />
                <SegaSkeleton className="sega-skeleton--inset h-3.5 w-full" />
                <SegaSkeleton className="sega-skeleton--inset h-3.5 w-[88%]" />
              </div>
              <div className="mt-auto pt-3">
                {/* text-xs map label */}
                <SegaSkeleton className="sega-skeleton--inset h-3 w-[6.5rem]" />
                {/* TrackMinimap viewBox 200×120, w-full + border-2 */}
                <SegaSkeleton className="mt-2 aspect-[200/120] w-full border-2 border-[var(--border)]" />
                {/* sega-btn text-sm: padding 0.5rem 1rem + «Старт» */}
                <SegaSkeleton className="mt-4 h-[2.35rem] w-[4.75rem]" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  );
};

type TLeaderboardTabsSkeletonProps = {
  /** Число табов-заглушек (по умолчанию = числу трасс) */
  count?: number;
};

/** Ширины табов по порядку TRACK_SLUGS (Coastal / Night City / Storm Eight) */
const TRACK_TAB_WIDTHS = ['w-[6.75rem]', 'w-[5.75rem]', 'w-[5rem]'];

/** Скелетон табов трасс на лидерборде (как блок track tabs) */
export const LeaderboardTabsSkeleton = ({
  count = TRACK_SLUGS.length,
}: TLeaderboardTabsSkeletonProps) => {
  const { t } = useTranslation();

  return (
    <SkeletonRegion label={t('tracks.loading')} className="mt-4">
      {/* text-sm font-medium uppercase «Трасса» */}
      <SegaSkeleton className="sega-skeleton--inset mb-2 h-5 w-14" />
      <div className="sega-track-tabs">
        {Array.from({ length: count }, (_, index) => (
          /* sega-track-tab: min-w 8rem, padding 0.55rem 1.1rem */
          <div
            key={index}
            className="sega-track-tab pointer-events-none flex items-center justify-center"
            aria-hidden
          >
            <SegaSkeleton
              className={cx(
                'sega-skeleton--inset h-3.5',
                TRACK_TAB_WIDTHS[index % TRACK_TAB_WIDTHS.length],
              )}
            />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
};

/** Скелетон таблицы лидеров (как LeaderboardTable) */
export const LeaderboardTableSkeleton = () => {
  const { t } = useTranslation();

  return (
    <SkeletonRegion label={t('leaderboard.loading')}>
      <div className="sega-panel mt-4 overflow-x-auto p-2">
        <table className="w-full min-w-[28rem] table-fixed border-collapse text-left text-sm md:min-w-[32rem]">
          <colgroup>
            <col className="w-[5.5rem]" />
            <col />
            <col className="w-[6.75rem]" />
            <col className="w-[7.25rem]" />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-[var(--border)]">
              <th scope="col" className="px-3 py-2 font-medium">
                <SegaSkeleton className="sega-skeleton--inset h-3.5 w-12" />
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                <SegaSkeleton className="sega-skeleton--inset h-3.5 w-16" />
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                <SegaSkeleton className="sega-skeleton--inset h-3.5 w-12" />
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                <SegaSkeleton className="sega-skeleton--inset h-3.5 w-12" />
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }, (_, index) => (
              <tr key={index} className="border-b border-[var(--border)]">
                <td className="px-3 py-2">
                  <SegaSkeleton className="sega-skeleton--inset h-3.5 w-5" />
                </td>
                <td className="px-3 py-2">
                  <SegaSkeleton className="sega-skeleton--inset h-3.5 w-24" />
                </td>
                <td className="px-3 py-2">
                  <SegaSkeleton className="sega-skeleton--inset h-3.5 w-[4.25rem]" />
                </td>
                <td className="px-3 py-2">
                  <SegaSkeleton className="sega-skeleton--inset h-3.5 w-[4.5rem]" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SkeletonRegion>
  );
};

/** Скелетон профиля и лучших времен (как ProfilePage) */
export const ProfilePageSkeleton = () => {
  const { t } = useTranslation();

  return (
    <SkeletonRegion label={t('profile.loading')}>
      {/* nickname: body text, mt-3 */}
      <SegaSkeleton className="sega-skeleton--inset mt-3 h-6 w-28" />
      {/* h2 text-xl «Личные лучшие времена» */}
      <SegaSkeleton className="sega-skeleton--inset mt-8 h-7 w-[min(100%,17.5rem)]" />
      <ul className="mt-3 space-y-2">
        {Array.from({ length: 2 }, (_, index) => (
          <li
            key={index}
            className="sega-panel flex flex-wrap items-baseline justify-between gap-2 px-3 py-2"
          >
            <SegaSkeleton className="sega-skeleton--inset h-5 w-28" />
            <SegaSkeleton className="sega-skeleton--inset h-5 w-[4.5rem]" />
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  );
};

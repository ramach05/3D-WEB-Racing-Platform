import { useTranslation } from 'react-i18next';
import type { TLeaderboardEntry } from '@/entities/leaderboard';
import { cx, formatRaceTime } from '@/shared/lib';

type TLeaderboardTableProps = {
  /** Table rows */
  entries: TLeaderboardEntry[];
  /** Highlight the current player's row */
  highlightUserId?: string;
  /** Limit the number of visible rows (top-N) */
  maxRows?: number;
  /** 'page' — min-width + horizontal scroll for narrow screens. */
  variant?: 'page' | 'compact';
};

/** Leaderboard table with semantic markup */
export const LeaderboardTable = ({
  entries,
  highlightUserId,
  maxRows,
  variant = 'page',
}: TLeaderboardTableProps) => {
  const { t } = useTranslation();
  const rows = maxRows === undefined ? entries : entries.slice(0, maxRows);
  const compact = variant === 'compact';
  const pad = compact ? 'px-2 py-1.5' : 'px-3 py-2';

  return (
    <div
      className={cx('sega-panel p-2', compact ? 'mt-2' : 'mt-4 overflow-x-auto')}
      // Page table needs a focusable region so keyboards can scroll the min-width table
      role={compact ? undefined : 'region'}
      aria-label={compact ? undefined : t('a11y.tableScroll')}
      tabIndex={compact ? undefined : 0}
    >
      <table
        className={cx(
          'w-full border-collapse text-left',
          compact ? 'table-auto text-xs' : 'table-fixed text-sm min-w-[28rem] md:min-w-[32rem]',
        )}
      >
        <caption className="sr-only">{t('leaderboard.title')}</caption>
        {!compact ? (
          <colgroup>
            <col className="w-[5.5rem]" />
            <col />
            <col className="w-[6.75rem]" />
            <col className="w-[7.25rem]" />
          </colgroup>
        ) : null}
        <thead>
          <tr className="border-b-2 border-[var(--border)]">
            <th
              scope="col"
              className={cx('font-medium uppercase whitespace-nowrap text-[var(--sega-cyan)]', pad)}
            >
              {t('leaderboard.rank')}
            </th>
            <th scope="col" className={cx('font-medium uppercase text-[var(--sega-cyan)]', pad)}>
              {t('leaderboard.racer')}
            </th>
            <th
              scope="col"
              className={cx('font-medium uppercase whitespace-nowrap text-[var(--sega-cyan)]', pad)}
            >
              {t('leaderboard.time')}
            </th>
            {!compact ? (
              <th
                scope="col"
                className={cx(
                  'font-medium uppercase whitespace-nowrap text-[var(--sega-cyan)]',
                  pad,
                )}
              >
                {t('leaderboard.date')}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((entry) => {
            const isHighlight = highlightUserId !== undefined && entry.userId === highlightUserId;
            return (
              <tr
                key={`${entry.userId}-${entry.timeMs}`}
                className={cx(
                  'border-b border-[var(--border)]',
                  isHighlight && 'bg-[var(--sega-yellow)]/15',
                )}
              >
                <td className={cx('whitespace-nowrap tabular-nums', pad)}>{entry.rank}</td>
                <td
                  className={cx(
                    'truncate',
                    pad,
                    isHighlight
                      ? 'font-semibold text-[var(--sega-yellow)]'
                      : 'text-[var(--sega-magenta)]',
                  )}
                >
                  {entry.nickname}
                </td>
                <td className={cx('whitespace-nowrap tabular-nums', pad)}>
                  {formatRaceTime(entry.timeMs)}
                </td>
                {!compact ? (
                  <td className={cx('whitespace-nowrap', pad)}>
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

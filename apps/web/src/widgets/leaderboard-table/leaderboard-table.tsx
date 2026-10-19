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
};

/** Leaderboard table with semantic markup */
export const LeaderboardTable = ({ entries, highlightUserId, maxRows }: TLeaderboardTableProps) => {
  const { t } = useTranslation();
  const rows = maxRows === undefined ? entries : entries.slice(0, maxRows);

  return (
    <div
      className="sega-panel mt-4 overflow-x-auto p-2"
      // Keyboard users need the container focusable to scroll wide tables
      role="region"
      aria-label={t('a11y.tableScroll')}
      tabIndex={0}
    >
      <table className="w-full min-w-[28rem] table-fixed border-collapse text-left text-sm md:min-w-[32rem]">
        <caption className="sr-only">{t('leaderboard.title')}</caption>
        <colgroup>
          <col className="w-[5.5rem]" />
          <col />
          <col className="w-[6.75rem]" />
          <col className="w-[7.25rem]" />
        </colgroup>
        <thead>
          <tr className="border-b-2 border-[var(--border)]">
            <th
              scope="col"
              className="px-3 py-2 font-medium uppercase whitespace-nowrap text-[var(--sega-cyan)]"
            >
              {t('leaderboard.rank')}
            </th>
            <th scope="col" className="px-3 py-2 font-medium uppercase text-[var(--sega-cyan)]">
              {t('leaderboard.racer')}
            </th>
            <th
              scope="col"
              className="px-3 py-2 font-medium uppercase whitespace-nowrap text-[var(--sega-cyan)]"
            >
              {t('leaderboard.time')}
            </th>
            <th
              scope="col"
              className="px-3 py-2 font-medium uppercase whitespace-nowrap text-[var(--sega-cyan)]"
            >
              {t('leaderboard.date')}
            </th>
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
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">{entry.rank}</td>
                <td
                  className={cx(
                    'truncate px-3 py-2',
                    isHighlight
                      ? 'font-semibold text-[var(--sega-yellow)]'
                      : 'text-[var(--sega-magenta)]',
                  )}
                >
                  {entry.nickname}
                </td>
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                  {formatRaceTime(entry.timeMs)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {new Date(entry.createdAt).toLocaleDateString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

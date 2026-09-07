import { useTranslation } from 'react-i18next';
import type { TLeaderboardEntry } from '@/entities/leaderboard';
import { cx, formatRaceTime } from '@/shared/lib';

type TLeaderboardTableProps = {
  entries: TLeaderboardEntry[];
  /** Подсветить строку текущего игрока */
  highlightUserId?: string;
  /** Ограничить число видимых строк (топ-N) */
  maxRows?: number;
};

/** Таблица лидеров с семантической разметкой */
export const LeaderboardTable = ({ entries, highlightUserId, maxRows }: TLeaderboardTableProps) => {
  const { t } = useTranslation();
  const rows = maxRows === undefined ? entries : entries.slice(0, maxRows);

  return (
    <div className="sega-panel mt-4 overflow-x-auto p-2">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <caption className="sr-only">{t('leaderboard.title')}</caption>
        <thead>
          <tr className="border-b-2 border-[var(--border)]">
            <th scope="col" className="px-3 py-2 font-medium uppercase text-[var(--sega-cyan)]">
              {t('leaderboard.rank')}
            </th>
            <th scope="col" className="px-3 py-2 font-medium uppercase text-[var(--sega-cyan)]">
              {t('leaderboard.racer')}
            </th>
            <th scope="col" className="px-3 py-2 font-medium uppercase text-[var(--sega-cyan)]">
              {t('leaderboard.time')}
            </th>
            <th scope="col" className="px-3 py-2 font-medium uppercase text-[var(--sega-cyan)]">
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
                <td className="px-3 py-2">{entry.rank}</td>
                <td
                  className={cx(
                    'px-3 py-2',
                    isHighlight
                      ? 'font-semibold text-[var(--sega-yellow)]'
                      : 'text-[var(--sega-magenta)]',
                  )}
                >
                  {entry.nickname}
                </td>
                <td className="px-3 py-2">{formatRaceTime(entry.timeMs)}</td>
                <td className="px-3 py-2">{new Date(entry.createdAt).toLocaleDateString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

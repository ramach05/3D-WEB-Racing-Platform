import { useTranslation } from 'react-i18next';
import type { LeaderboardEntry } from '@/entities/leaderboard';
import { formatRaceTime } from '@/shared/lib';

type LeaderboardTableProps = {
  entries: LeaderboardEntry[];
};

/** Таблица лидеров с семантической разметкой */
export const LeaderboardTable = ({ entries }: LeaderboardTableProps) => {
  const { t } = useTranslation();

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
          {entries.map((entry) => (
            <tr key={`${entry.userId}-${entry.timeMs}`} className="border-b border-[var(--border)]">
              <td className="px-3 py-2">{entry.rank}</td>
              <td className="px-3 py-2 text-[var(--sega-magenta)]">{entry.nickname}</td>
              <td className="px-3 py-2 font-mono">{formatRaceTime(entry.timeMs)}</td>
              <td className="px-3 py-2">{new Date(entry.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

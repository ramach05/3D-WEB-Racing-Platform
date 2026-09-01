/** Строка глобальной таблицы лидеров */
export type LeaderboardEntry = {
  rank: number;
  userId: string;
  nickname: string;
  timeMs: number;
  createdAt: string;
};

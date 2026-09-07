/** Строка глобальной таблицы лидеров */
export type TLeaderboardEntry = {
  rank: number;
  userId: string;
  nickname: string;
  timeMs: number;
  createdAt: string;
};

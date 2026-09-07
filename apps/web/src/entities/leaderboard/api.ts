import type { TLeaderboardEntry } from '@racing/shared';
import { racingApi } from '@/shared/api';

/** RTK endpoint таблицы лидеров по trackId */
export const leaderboardApi = racingApi.injectEndpoints({
  endpoints: (build) => ({
    getLeaderboard: build.query<TLeaderboardEntry[], string>({
      query: (trackId) => `/leaderboard?trackId=${encodeURIComponent(trackId)}`,
      providesTags: (_result, _error, trackId) => [{ type: 'Leaderboard', id: trackId }],
    }),
  }),
});

export const { useGetLeaderboardQuery } = leaderboardApi;

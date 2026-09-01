import type { LeaderboardEntry } from '@racing/shared';
import { racingApi } from '@/shared/api';

export const leaderboardApi = racingApi.injectEndpoints({
  endpoints: (build) => ({
    getLeaderboard: build.query<LeaderboardEntry[], string>({
      query: (trackId) => `/leaderboard?trackId=${encodeURIComponent(trackId)}`,
      providesTags: (_result, _error, trackId) => [{ type: 'Leaderboard', id: trackId }],
    }),
  }),
});

export const { useGetLeaderboardQuery } = leaderboardApi;

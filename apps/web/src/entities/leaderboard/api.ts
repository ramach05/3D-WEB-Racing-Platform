import type { TLeaderboardEntry } from '@racing/shared';
import { racingApi } from '@/shared/api';

/** RTK endpoint for the leaderboard by trackSlug */
export const leaderboardApi = racingApi.injectEndpoints({
  endpoints: (build) => ({
    getLeaderboard: build.query<TLeaderboardEntry[], string>({
      query: (trackSlug) => `/leaderboard?trackSlug=${encodeURIComponent(trackSlug)}`,
      providesTags: (_result, _error, trackSlug) => [{ type: 'Leaderboard', id: trackSlug }],
    }),
  }),
});

export const { useGetLeaderboardQuery } = leaderboardApi;

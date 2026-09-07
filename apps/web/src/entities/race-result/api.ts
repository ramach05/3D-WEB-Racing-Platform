import type { TCreateRaceResultRequest, TRaceResultPublic } from '@racing/shared';
import { racingApi } from '@/shared/api';

/** RTK mutation создания результата заезда */
export const raceResultApi = racingApi.injectEndpoints({
  endpoints: (build) => ({
    createRaceResult: build.mutation<TRaceResultPublic, TCreateRaceResultRequest>({
      query: (body) => ({ url: '/race-results', method: 'POST', body }),
      invalidatesTags: ['Me', 'Leaderboard'],
    }),
  }),
});

export const { useCreateRaceResultMutation } = raceResultApi;

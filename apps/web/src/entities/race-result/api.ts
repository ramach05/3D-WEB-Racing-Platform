import type { CreateRaceResultRequest, RaceResultPublic } from '@racing/shared';
import { racingApi } from '@/shared/api';

export const raceResultApi = racingApi.injectEndpoints({
  endpoints: (build) => ({
    createRaceResult: build.mutation<RaceResultPublic, CreateRaceResultRequest>({
      query: (body) => ({ url: '/race-results', method: 'POST', body }),
      invalidatesTags: ['Me', 'Leaderboard'],
    }),
  }),
});

export const { useCreateRaceResultMutation } = raceResultApi;

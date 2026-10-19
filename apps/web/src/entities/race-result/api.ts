import type { TCreateRaceResultRequest, TRaceResultPublic } from '@racing/shared';
import { racingApi } from '@/shared/api';

/** Mutation argument: trackSlug is only needed to invalidate the leaderboard cache */
type TCreateRaceResultArg = TCreateRaceResultRequest & {
  trackSlug: string;
};

/** RTK mutation that creates a race result */
export const raceResultApi = racingApi.injectEndpoints({
  endpoints: (build) => ({
    createRaceResult: build.mutation<TRaceResultPublic, TCreateRaceResultArg>({
      query: ({ trackId, timeMs }) => ({
        url: '/race-results',
        method: 'POST',
        // API expects an integer (@IsInt); performance.now() returns a float
        body: { trackId, timeMs: Math.round(timeMs) } satisfies TCreateRaceResultRequest,
      }),
      invalidatesTags: (_result, _error, { trackSlug }) => [
        'Me',
        { type: 'Leaderboard', id: trackSlug },
      ],
    }),
  }),
});

export const { useCreateRaceResultMutation } = raceResultApi;

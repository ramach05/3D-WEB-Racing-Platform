import type { TCreateRaceResultRequest, TRaceResultPublic } from '@racing/shared';
import { racingApi } from '@/shared/api';

/** Аргумент mutation: trackSlug нужен только для инвалидации кэша leaderboard */
type TCreateRaceResultArg = TCreateRaceResultRequest & {
  trackSlug: string;
};

/** RTK mutation создания результата заезда */
export const raceResultApi = racingApi.injectEndpoints({
  endpoints: (build) => ({
    createRaceResult: build.mutation<TRaceResultPublic, TCreateRaceResultArg>({
      query: ({ trackId, timeMs }) => ({
        url: '/race-results',
        method: 'POST',
        // API ждет целое (@IsInt); performance.now() дает float
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

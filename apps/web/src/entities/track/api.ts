import type { TTrackPublic } from '@racing/shared';
import { racingApi } from '@/shared/api';

export const trackApi = racingApi.injectEndpoints({
  endpoints: (build) => ({
    getTracks: build.query<TTrackPublic[], void>({
      query: () => '/tracks',
      providesTags: ['Track'],
    }),
  }),
});

export const { useGetTracksQuery } = trackApi;

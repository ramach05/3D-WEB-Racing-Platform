import type { TrackPublic } from '@racing/shared';
import { racingApi } from '@/shared/api';

export const trackApi = racingApi.injectEndpoints({
  endpoints: (build) => ({
    getTracks: build.query<TrackPublic[], void>({
      query: () => '/tracks',
      providesTags: ['Track'],
    }),
  }),
});

export const { useGetTracksQuery } = trackApi;

/** Трасса, как её видит клиент */
export type TTrackPublic = {
  id: string;
  slug: string;
  name: string;
  isAvailable: boolean;
};

export const TRACK_SLUG_COASTAL_OVAL = 'coastal-oval';
export const TRACK_SLUG_NIGHT_CITY = 'night-city';
export const TRACK_SLUG_STORM_EIGHT = 'storm-eight';

export const TRACK_SLUGS = [TRACK_SLUG_COASTAL_OVAL, TRACK_SLUG_NIGHT_CITY, TRACK_SLUG_STORM_EIGHT] as const;

export type TTrackSlug = (typeof TRACK_SLUGS)[number];

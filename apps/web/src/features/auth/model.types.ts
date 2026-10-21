import type { TUserPublic } from '@racing/shared';

export type TAuthState = {
  /** Current user, or null if guest */
  user: TUserPublic | null;
  /** Refresh-session hydration finished (status unknown before that) */
  hydrated: boolean;
};

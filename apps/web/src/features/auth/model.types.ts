import type { TUserPublic } from '@racing/shared';

export type TAuthState = {
  /** Текущий пользователь или null, если гость */
  user: TUserPublic | null;
};

import type { TUserPublic } from '@racing/shared';

export type TAuthState = {
  /** Текущий пользователь или null, если гость */
  user: TUserPublic | null;
  /** Гидрация refresh-сессии завершена (до этого статус неизвестен) */
  hydrated: boolean;
};

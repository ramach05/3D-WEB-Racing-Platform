import type { TUserPublic } from '@racing/shared';

type TUserRow = {
  id: string;
  nickname: string;
  createdAt: Date;
};

/** Убирает хеш пароля и приводит дату к ISO */
export const toUserPublic = (user: TUserRow): TUserPublic => {
  return {
    id: user.id,
    nickname: user.nickname,
    createdAt: user.createdAt.toISOString(),
  };
};

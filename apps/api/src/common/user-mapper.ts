import type { UserPublic } from '@racing/shared';

type UserRow = {
  id: string;
  nickname: string;
  createdAt: Date;
};

/** Убирает хеш пароля и приводит дату к ISO */
export const toUserPublic = (user: UserRow): UserPublic => {
  return {
    id: user.id,
    nickname: user.nickname,
    createdAt: user.createdAt.toISOString(),
  };
};

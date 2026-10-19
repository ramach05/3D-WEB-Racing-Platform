import type { TUserPublic } from '@racing/shared';

type TUserRow = {
  id: string;
  nickname: string;
  createdAt: Date;
};

/** Strips the password hash and converts the date to ISO */
export const toUserPublic = (user: TUserRow): TUserPublic => {
  return {
    id: user.id,
    nickname: user.nickname,
    createdAt: user.createdAt.toISOString(),
  };
};

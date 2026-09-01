import type { CaughtError } from '@racing/shared';
import { getErrorMessage as getSharedErrorMessage } from '@racing/shared';
import { cx } from './cx';
import { formatRaceTime } from './format';
import { getRtkErrorMessage } from './rtk-error';
import { clearAuthSession, readAuthSession, writeAuthSession } from './session';

export type { AuthSession } from './session';

/** Достаёт текст ошибки для UI */
export const getErrorMessage = (error: CaughtError): string => {
  return getSharedErrorMessage(error);
};

export {
  clearAuthSession,
  cx,
  formatRaceTime,
  getRtkErrorMessage,
  readAuthSession,
  writeAuthSession,
};

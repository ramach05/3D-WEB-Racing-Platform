import type { TCaughtError } from '@racing/shared';
import { getErrorMessage as getSharedErrorMessage } from '@racing/shared';
import { cx } from './cx';
import { formatGap, formatRaceTime } from './format';
import { getRtkErrorMessage } from './rtk-error';
import { clearAuthSession, readAuthSession, writeAuthSession } from './session';
import { useFocusTrap } from './use-focus-trap';

export type { TAuthSession } from './session.types';

/** Extracts the error text for the UI */
export const getErrorMessage = (error: TCaughtError): string => {
  return getSharedErrorMessage(error);
};

export {
  clearAuthSession,
  cx,
  formatGap,
  formatRaceTime,
  getRtkErrorMessage,
  readAuthSession,
  useFocusTrap,
  writeAuthSession,
};

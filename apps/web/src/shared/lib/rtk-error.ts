import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { TApiErrorBody } from '@racing/shared';
import { flattenApiMessage } from '@racing/shared';

/** Достает текст ошибки RTK Query для форм */
export const getRtkErrorMessage = (error: FetchBaseQueryError): string => {
  if (
    error.status === 'FETCH_ERROR' ||
    error.status === 'PARSING_ERROR' ||
    error.status === 'TIMEOUT_ERROR'
  ) {
    return error.error;
  }
  if (error.status === 'CUSTOM_ERROR') {
    return error.error;
  }

  const data = error.data as TApiErrorBody | string | null;
  if (typeof data === 'string' && data.length > 0) {
    return data;
  }
  if (data && typeof data === 'object' && 'message' in data) {
    return flattenApiMessage(data.message);
  }
  return 'Request failed';
};

/** Nest / ValidationPipe error body */
export type TApiErrorBody = {
  statusCode: number;
  message: string | string[];
  error: string;
};

/** A value that can be safely turned into error text */
export type TCaughtError = {
  message?: string;
  toString: () => string;
};

/** Extracts human-readable text from an error without any/unknown */
export const getErrorMessage = (error: TCaughtError): string => {
  if (typeof error.message === 'string' && error.message.length > 0) {
    return error.message;
  }

  return error.toString();
};

/** Reduces a Nest message (string or array) to a single string */
export const flattenApiMessage = (message: string | string[]): string => {
  if (typeof message === 'string') {
    return message;
  }

  return message.join(', ');
};

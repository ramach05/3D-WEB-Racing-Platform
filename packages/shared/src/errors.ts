/** Тело ошибки Nest / ValidationPipe */
export type TApiErrorBody = {
  statusCode: number;
  message: string | string[];
  error: string;
};

/** Значение, которое можно безопасно превратить в текст ошибки */
export type TCaughtError = {
  message?: string;
  toString: () => string;
};

/** Достаёт человекочитаемый текст из ошибки без any/unknown */
export const getErrorMessage = (error: TCaughtError): string => {
  if (typeof error.message === 'string' && error.message.length > 0) {
    return error.message;
  }

  return error.toString();
};

/** Сводит message из Nest (строка или массив) к одной строке */
export const flattenApiMessage = (message: string | string[]): string => {
  if (typeof message === 'string') {
    return message;
  }

  return message.join(', ');
};

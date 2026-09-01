/** Склеивает className без лишних пробелов */
export const cx = (...parts: Array<string | false | null>): string => {
  return parts
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ');
};

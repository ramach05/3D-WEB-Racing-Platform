const NICKNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

/** Проверяет ник по правилам приложения */
export const isValidNickname = (nickname: string): boolean => {
  return NICKNAME_RE.test(nickname.trim());
};

/** Проверяет пароль (минимум 4 символа) */
export const isValidPassword = (password: string): boolean => {
  return password.length >= 4;
};

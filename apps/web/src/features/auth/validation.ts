const NICKNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

/** Validates a nickname against app rules */
export const isValidNickname = (nickname: string): boolean => {
  return NICKNAME_RE.test(nickname.trim());
};

/** Validates password (minimum 4 characters) */
export const isValidPassword = (password: string): boolean => {
  return password.length >= 4;
};

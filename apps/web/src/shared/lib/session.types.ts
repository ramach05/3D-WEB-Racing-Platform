export type TAuthSession = {
  /** JWT access в памяти; refresh только в httpOnly cookie */
  accessToken: string;
};

export type TAuthSession = {
  /** Access JWT in memory; refresh only in the httpOnly cookie */
  accessToken: string;
};

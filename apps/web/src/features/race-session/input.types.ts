export type TDriveInput = {
  /** Газ: 0 или 1 */
  throttle: number;
  /** Руль: −1…1 (влево +, вправо −) */
  steer: number;
  /** Тормоз/назад: 0 или 1 */
  brake: number;
};

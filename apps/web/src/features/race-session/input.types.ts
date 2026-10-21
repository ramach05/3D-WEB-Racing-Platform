export type TDriveInput = {
  /** Throttle: 0 or 1 */
  throttle: number;
  /** Steering: −1…1 (left +, right −) */
  steer: number;
  /** Brake/reverse: 0 or 1 */
  brake: number;
  /** Handbrake: 0 or 1 */
  handbrake: number;
};

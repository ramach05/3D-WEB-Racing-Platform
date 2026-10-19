export type TTrackProgress = {
  /** Index of the current loop segment */
  segmentIndex: number;
  /** Parameter inside the segment: 0..1 */
  segmentT: number;
  /** Position on the lap: 0..1 */
  ratio: number;
};

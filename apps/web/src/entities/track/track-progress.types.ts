export type TTrackProgress = {
  /** Индекс текущего сегмента петли */
  segmentIndex: number;
  /** Параметр внутри сегмента: 0..1 */
  segmentT: number;
  /** Позиция на круге: 0..1 */
  ratio: number;
};

export type TSpectatorSeat = {
  /** Мировая X */
  x: number;
  /** Мировая Y */
  y: number;
  /** Мировая Z */
  z: number;
  /** Угол взгляда (рад) */
  yaw: number;
  /** Фаза анимации рук */
  phase: number;
  /** Фаза наклона корпуса */
  leanPhase: number;
  /** Скорость покачивания */
  bobSpeed: number;
  /** Скорость маха руками */
  waveSpeed: number;
  /** Масштаб по X */
  scaleX: number;
  /** Масштаб по Y */
  scaleY: number;
  /** Машет руками */
  waves: boolean;
  /** Цвет футболки */
  shirtColor: string;
  /** Цвет кожи */
  skinColor: string;
  /** Цвет штанов */
  pantsColor: string;
};

export type TBuildSpectatorSeatsOptions = {
  /** Внутренний X трибуны относительно старта */
  tribuneInnerX: number;
  /** Знак стороны (−1 / +1) */
  sideSign: number;
  /** Число зрителей в секции */
  count: number;
  /** Ширина секции */
  sectionWidth: number;
  /** Шаг центров соседних секций — ограничивает рассадку, чтобы стыки не пустели и не пересекались */
  sectionPitch: number;
};

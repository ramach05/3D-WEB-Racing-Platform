export type TSpectatorSeat = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  phase: number;
  leanPhase: number;
  bobSpeed: number;
  waveSpeed: number;
  scaleX: number;
  scaleY: number;
  waves: boolean;
  shirtColor: string;
  skinColor: string;
  pantsColor: string;
};

export type TBuildSpectatorSeatsOptions = {
  tribuneInnerX: number;
  sideSign: number;
  count: number;
  sectionWidth: number;
  /** Шаг центров соседних секций — ограничивает рассадку, чтобы стыки не пустели и не пересекались */
  sectionPitch: number;
};

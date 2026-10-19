export type TSpectatorBehavior = 'watch' | 'lean' | 'waveOne' | 'clap' | 'cheer' | 'phone';

export type TSpectatorWaveSide = 'left' | 'right';

export type TSpectatorSeat = {
  /** World X */
  x: number;
  /** World Y */
  y: number;
  /** World Z */
  z: number;
  /** Facing angle (rad) */
  yaw: number;
  /** Arm animation phase */
  phase: number;
  /** Body lean phase */
  leanPhase: number;
  /** Bobbing speed */
  bobSpeed: number;
  /** Arm waving speed */
  waveSpeed: number;
  /** X scale */
  scaleX: number;
  /** Y scale */
  scaleY: number;
  /** Spectator behavior */
  behavior: TSpectatorBehavior;
  /** Waving arm side (for waveOne / phone) */
  waveSide: TSpectatorWaveSide;
  /** Has a cap */
  hasCap: boolean;
  /** Has a flag */
  hasFlag: boolean;
  /** Has hair (only without a cap) */
  hasHair: boolean;
  /** Shirt color */
  shirtColor: string;
  /** Skin color */
  skinColor: string;
  /** Pants color */
  pantsColor: string;
  /** Cap / hair / flag color */
  accentColor: string;
};

export type TBuildSpectatorSeatsOptions = {
  /** Tribune inner X relative to the start line */
  tribuneInnerX: number;
  /** Side sign (−1 / +1) */
  sideSign: number;
  /** Spectator count per section */
  count: number;
  /** Section width */
  sectionWidth: number;
  /** Center-to-center pitch of adjacent sections — clamps seating so joints stay filled and non-overlapping */
  sectionPitch: number;
};

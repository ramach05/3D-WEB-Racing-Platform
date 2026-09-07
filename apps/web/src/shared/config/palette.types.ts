/** Hex-цвет (#rgb / #rrggbb / #rrggbbaa) */
export type THexColor = `#${string}`;

/** rgb() / rgba() — стопы градиентов горизонта */
export type TRgbaColor = `rgb(${string})` | `rgba(${string})`;

/** CSS-цвет для UI-токенов и 3D-материалов */
export type TCssColor = THexColor | TRgbaColor;

/** Стоп радиального градиента (canvas / horizon) */
export type TRadialColorStop = {
  stop: number;
  color: TCssColor;
};

/** UI-токены одной темы (мапятся в CSS-переменные --bg, --fg, …) */
export type TUiThemeColors = {
  bg: TCssColor;
  fg: TCssColor;
  muted: TCssColor;
  surface: TCssColor;
  'surface-hover': TCssColor;
  border: TCssColor;
  accent: TCssColor;
  'accent-fg': TCssColor;
  danger: TCssColor;
  'sega-cyan': TCssColor;
  'sega-magenta': TCssColor;
  'sega-yellow': TCssColor;
  'sega-orange': TCssColor;
};

export type TUiColorToken = keyof TUiThemeColors;

export type TUiPalette = {
  light: TUiThemeColors;
  dark: TUiThemeColors;
};

/** Доп. UI-цвета, не зависящие от light/dark */
export type TUiChrome = {
  /** Текст на жёлтом активном табе */
  onYellow: TCssColor;
  /** Полосы finish wipe */
  finishWipeDark: TCssColor;
  finishWipeLight: TCssColor;
};

export type TUiChromeToken = keyof TUiChrome;

/** Палитра материалов трассы (shape совместим с TTrackPalette) */
export type TTrackPaletteColors = {
  sky: TCssColor;
  fog: TCssColor;
  ground: TCssColor;
  road: TCssColor;
  wall: TCssColor;
  accent: TCssColor;
  minimapRoad: TCssColor;
  minimapWall: TCssColor;
  minimapBg: TCssColor;
};

export type TTrackPaletteToken = keyof TTrackPaletteColors;
export type TTrackPaletteId = 'coastal' | 'night';

export type TTrackPalettes = Record<TTrackPaletteId, TTrackPaletteColors>;

/** Окраска машины (shape совместим с TCarSkin) */
export type TCarSkinColors = {
  body: TCssColor;
  cabin: TCssColor;
  wheel: TCssColor;
};

export type TCarSkinToken = keyof TCarSkinColors;
export type TCarSkins = Record<TTrackPaletteId, TCarSkinColors>;

export type TTreeTimeOfDayColors = {
  trunk: TCssColor;
  pine: TCssColor;
  broadleaf: TCssColor;
};

export type TTreePaletteToken = keyof TTreeTimeOfDayColors;

export type TTreePalette = {
  day: TTreeTimeOfDayColors;
  night: TTreeTimeOfDayColors;
};

export type TCrowdPalette = {
  shirtDay: readonly TCssColor[];
  shirtNight: readonly TCssColor[];
  skin: readonly TCssColor[];
  pantsDay: readonly TCssColor[];
  pantsNight: readonly TCssColor[];
  meshBase: TCssColor;
  emissiveOff: TCssColor;
  skinEmissiveNight: TCssColor;
};

export type TTribuneDayColors = {
  structure: TCssColor;
  step: TCssColor;
  platform: TCssColor;
};

export type TTribuneNightColors = TTribuneDayColors & {
  rail: TCssColor;
};

export type TTribunePalette = {
  day: TTribuneDayColors;
  night: TTribuneNightColors;
  emissiveOff: TCssColor;
};

export type TVehiclePalette = {
  headlight: TCssColor;
  glass: TCssColor;
  brake: TCssColor;
  brakeEmissive: TCssColor;
  headlamp: TCssColor;
  headlampEmissive: TCssColor;
  rim: TCssColor;
};

export type TVehiclePaletteToken = keyof TVehiclePalette;

export type TStartLightPalette = {
  idle: TCssColor;
  red: TCssColor;
  amber: TCssColor;
  green: TCssColor;
};

export type TStartLightToken = keyof TStartLightPalette;

export type THorizonSunStops = {
  core: readonly TRadialColorStop[];
  corona: readonly TRadialColorStop[];
  glow: readonly TRadialColorStop[];
};

export type THorizonMoonStops = {
  disk: readonly TRadialColorStop[];
  limb: readonly TRadialColorStop[];
  glow: readonly TRadialColorStop[];
  halo: readonly TRadialColorStop[];
};

export type TScenePalette = {
  white: TCssColor;
  black: TCssColor;
  checkerDark: TCssColor;
  sunDay: TCssColor;
  sunNight: TCssColor;
  obstacle: TCssColor;
};

export type TScenePaletteToken = keyof TScenePalette;

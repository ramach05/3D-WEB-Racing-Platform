/** Hex color (#rgb / #rrggbb / #rrggbbaa) */
export type THexColor = `#${string}`;

/** rgb() / rgba() — horizon gradient stops */
export type TRgbaColor = `rgb(${string})` | `rgba(${string})`;

/** CSS color for UI tokens and 3D materials */
export type TCssColor = THexColor | TRgbaColor;

/** Radial gradient stop (canvas / horizon) */
export type TRadialColorStop = {
  /** Stop position 0..1 */
  stop: number;
  /** Stop color */
  color: TCssColor;
};

/** UI tokens of one theme (mapped to CSS variables --bg, --fg, …) */
export type TUiThemeColors = {
  /** Page background */
  bg: TCssColor;
  /** Main text */
  fg: TCssColor;
  /** Muted text */
  muted: TCssColor;
  /** Card/panel surface */
  surface: TCssColor;
  /** Surface hover */
  'surface-hover': TCssColor;
  /** Borders */
  border: TCssColor;
  /** Accent */
  accent: TCssColor;
  /** Text on accent */
  'accent-fg': TCssColor;
  /** Errors / danger */
  danger: TCssColor;
  /** SEGA cyan */
  'sega-cyan': TCssColor;
  /** SEGA magenta */
  'sega-magenta': TCssColor;
  /** SEGA yellow */
  'sega-yellow': TCssColor;
  /** SEGA orange */
  'sega-orange': TCssColor;
};

export type TUiColorToken = keyof TUiThemeColors;

export type TUiPalette = {
  /** Light theme */
  light: TUiThemeColors;
  /** Dark theme */
  dark: TUiThemeColors;
};

/** Extra UI colors independent of light/dark */
export type TUiChrome = {
  /** Text on the yellow active tab */
  onYellow: TCssColor;
  /** Finish wipe stripes (dark) */
  finishWipeDark: TCssColor;
  /** Finish wipe stripes (light) */
  finishWipeLight: TCssColor;
};

export type TUiChromeToken = keyof TUiChrome;

/** Track material palette (shape compatible with TTrackPalette) */
export type TTrackPaletteColors = {
  /** Sky color / clearColor */
  sky: TCssColor;
  /** Fog color */
  fog: TCssColor;
  /** Ground around the track */
  ground: TCssColor;
  /** Asphalt */
  road: TCssColor;
  /** Walls */
  wall: TCssColor;
  /** Road-marking / neon accent */
  accent: TCssColor;
  /** Road on the minimap */
  minimapRoad: TCssColor;
  /** Walls on the minimap */
  minimapWall: TCssColor;
  /** Minimap background */
  minimapBg: TCssColor;
};

export type TTrackPaletteToken = keyof TTrackPaletteColors;
export type TTrackPaletteId = 'coastal' | 'night' | 'storm';

export type TTrackPalettes = Record<TTrackPaletteId, TTrackPaletteColors>;

/** Car paint (shape compatible with TCarSkin) */
export type TCarSkinColors = {
  /** Body */
  body: TCssColor;
  /** Cabin */
  cabin: TCssColor;
  /** Tires */
  wheel: TCssColor;
};

export type TCarSkinToken = keyof TCarSkinColors;
export type TCarSkins = Record<TTrackPaletteId, TCarSkinColors>;

export type TTreeTimeOfDayColors = {
  /** Trunk / bark */
  trunk: TCssColor;
  /** Mid-tier pine foliage */
  pine: TCssColor;
  /** Lower pine tier (darker) */
  pineDark: TCssColor;
  /** Upper pine tier (lighter) */
  pineLight: TCssColor;
  /** Main broadleaf crown */
  broadleaf: TCssColor;
  /** Light lobes of broadleaf */
  broadleafLight: TCssColor;
};

export type TTreePaletteToken = keyof TTreeTimeOfDayColors;

export type TTreePalette = {
  /** Daytime tree colors */
  day: TTreeTimeOfDayColors;
  /** Night tree colors */
  night: TTreeTimeOfDayColors;
};

export type TCrowdPalette = {
  /** Shirts by day */
  shirtDay: readonly TCssColor[];
  /** Shirts at night */
  shirtNight: readonly TCssColor[];
  /** Skin tones */
  skin: readonly TCssColor[];
  /** Pants by day */
  pantsDay: readonly TCssColor[];
  /** Pants at night */
  pantsNight: readonly TCssColor[];
  /** Hair / dark caps */
  hair: readonly TCssColor[];
  /** Caps (racing colors) */
  cap: readonly TCssColor[];
  /** Base mesh color before instanceColor */
  meshBase: TCssColor;
  /** Emissive off */
  emissiveOff: TCssColor;
  /** Skin emissive at night */
  skinEmissiveNight: TCssColor;
};

export type TTribuneDayColors = {
  /** Grandstand frame */
  structure: TCssColor;
  /** Steps */
  step: TCssColor;
  /** Platform */
  platform: TCssColor;
  /** Seat slats */
  seat: TCssColor;
  /** Handrail metal */
  metal: TCssColor;
};

export type TTribuneNightColors = TTribuneDayColors & {
  /** Handrails / canopy at night */
  rail: TCssColor;
};

export type TTribunePalette = {
  /** Daytime grandstand colors */
  day: TTribuneDayColors;
  /** Night grandstand colors */
  night: TTribuneNightColors;
  /** Emissive off */
  emissiveOff: TCssColor;
};

export type TVehiclePalette = {
  /** Headlight beam color */
  headlight: TCssColor;
  /** Cabin glass */
  glass: TCssColor;
  /** Brake lights */
  brake: TCssColor;
  /** Dark-red brake lens polycarbonate (off) */
  brakeGlass: TCssColor;
  /** Brake light emissive */
  brakeEmissive: TCssColor;
  /** Dark amber turn-signal lenses */
  signalGlass: TCssColor;
  /** Reverse light emissive */
  reverseEmissive: TCssColor;
  /** Headlamp housing */
  headlamp: TCssColor;
  /** Headlamp emissive */
  headlampEmissive: TCssColor;
  /** Rims */
  rim: TCssColor;
};

export type TVehiclePaletteToken = keyof TVehiclePalette;

export type TStartLightPalette = {
  /** Lamp off (smoked glass) */
  idle: TCssColor;
  /** Red (F1 countdown) */
  red: TCssColor;
  /** Amber (finish flash) */
  amber: TCssColor;
  /** Green (reserved; F1 start = reds out) */
  green: TCssColor;
  /** Metal of gantry posts and beam */
  steel: TCssColor;
  /** Dark metal / structural emissive base */
  steelDark: TCssColor;
  /** Lamp panel housing */
  housing: TCssColor;
  /** Lamp recess bezel */
  bezel: TCssColor;
  /** Stadium floodlight color on the gantry (Spot / Point / lens) */
  floodLight: TCssColor;
};

export type TStartLightToken = keyof TStartLightPalette;

export type TStreetLampPalette = {
  /** Pole trunk */
  pole: TCssColor;
  /** Bracket arm */
  arm: TCssColor;
  /** Lantern housing */
  housing: TCssColor;
  /** Glass / lens */
  lens: TCssColor;
  /** SpotLight / PointLight color */
  light: TCssColor;
};

export type TStreetLampToken = keyof TStreetLampPalette;

export type THorizonSunStops = {
  /** Sun core */
  core: readonly TRadialColorStop[];
  /** Corona */
  corona: readonly TRadialColorStop[];
  /** Outer glow */
  glow: readonly TRadialColorStop[];
};

export type THorizonMoonStops = {
  /** Moon disk */
  disk: readonly TRadialColorStop[];
  /** Disk edge */
  limb: readonly TRadialColorStop[];
  /** Outer glow */
  glow: readonly TRadialColorStop[];
  /** Halo */
  halo: readonly TRadialColorStop[];
};

export type TScenePalette = {
  /** White (road markings) */
  white: TCssColor;
  /** Black */
  black: TCssColor;
  /** Dark checker square */
  checkerDark: TCssColor;
  /** Daytime sun color */
  sunDay: TCssColor;
  /** Night light color */
  sunNight: TCssColor;
  /** Cold light of the invisible sun in storm rain */
  sunRain: TCssColor;
  /** Obstacle color (tires) */
  obstacle: TCssColor;
  /** Rubber marks on the asphalt */
  skidMark: TCssColor;
};

export type TScenePaletteToken = keyof TScenePalette;

export type TKerbPalette = {
  /** Red kerb stripe */
  red: TCssColor;
  /** White kerb stripe */
  white: TCssColor;
};

export type TBillboardAdColors = {
  /** Panel background */
  background: TCssColor;
  /** Main text / brand */
  foreground: TCssColor;
  /** Accent (stripe, logo blob) */
  accent: TCssColor;
  /** Secondary text / slogan */
  muted: TCssColor;
};

export type TBillboardPalette = {
  /** Steel poles */
  pole: TCssColor;
  /** Panel frame (light box of the paper billboard) */
  frame: TCssColor;
  /** Panel back side */
  panelBack: TCssColor;
  /** Fasteners / bolts */
  bolt: TCssColor;
  /** Floodlight bracket pipe */
  floodArm: TCssColor;
  /** Floodlight housing */
  floodHousing: TCssColor;
  /** Bulb off */
  floodBulbOff: TCssColor;
  /** Bulb on */
  floodBulbOn: TCssColor;
  /** SpotLight color */
  floodLight: TCssColor;
  /** Mockup colors by adId */
  ads: {
    'torque-cola': TBillboardAdColors;
    'apex-tires': TBillboardAdColors;
    'nitro-donuts': TBillboardAdColors;
    'pitstop-insurance': TBillboardAdColors;
    'for-rent': TBillboardAdColors;
  };
};

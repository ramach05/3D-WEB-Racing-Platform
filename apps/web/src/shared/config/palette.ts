import type {
  TBillboardPalette,
  TCarSkins,
  TCrowdPalette,
  THorizonMoonStops,
  THorizonSunStops,
  TKerbPalette,
  TScenePalette,
  TStartLightPalette,
  TStreetLampPalette,
  TTrackPalettes,
  TTreePalette,
  TTribunePalette,
  TUiChrome,
  TUiPalette,
  TVehiclePalette,
} from './palette.types';

/** UI-токены (мапятся в CSS-переменные --bg, --fg, …) */
export const uiPalette = {
  light: {
    bg: '#f4f0ff',
    fg: '#1a1033',
    muted: '#5a4a78',
    surface: '#ffffff',
    'surface-hover': '#ebe4ff',
    border: '#0066cc',
    accent: '#ff2bd6',
    'accent-fg': '#ffffff',
    danger: '#d62828',
    'sega-cyan': '#0088cc',
    'sega-magenta': '#cc2299',
    'sega-yellow': '#cc9900',
    'sega-orange': '#e86a00',
  },
  dark: {
    bg: '#08040f',
    fg: '#f3efe6',
    muted: '#9f8fc8',
    surface: '#140a24',
    'surface-hover': '#22123a',
    border: '#00b8d4',
    accent: '#ff4fd8',
    'accent-fg': '#120018',
    danger: '#ff7070',
    'sega-cyan': '#00e5ff',
    'sega-magenta': '#ff2bd6',
    'sega-yellow': '#ffe600',
    'sega-orange': '#ff7a00',
  },
} as const satisfies TUiPalette;

/** Доп. UI-цвета, не зависящие от light/dark */
export const uiChrome = {
  onYellow: '#120018',
  finishWipeDark: '#111',
  finishWipeLight: '#f5f5f5',
} as const satisfies TUiChrome;

/** Палитры трасс (shape совместим с TTrackPalette) */
export const trackPalettes = {
  coastal: {
    sky: '#4db4ff',
    fog: '#c8ecff',
    ground: '#dcb889',
    road: '#8a8a90',
    wall: '#f0e6c8',
    accent: '#ff7a00',
    minimapRoad: '#9a9aa2',
    minimapWall: '#ff7a00',
    minimapBg: '#5ebfff',
  },
  night: {
    sky: '#1c1040',
    fog: '#3a1e55',
    ground: '#8f7660',
    road: '#8a8a96',
    wall: '#b0aaa2',
    accent: '#ff2bd6',
    minimapRoad: '#5a5a68',
    minimapWall: '#ff2bd6',
    minimapBg: '#1c1234',
  },
} as const satisfies TTrackPalettes;

/** Окраска машины по трассе (shape совместим с TCarSkin) */
export const carSkins = {
  coastal: { body: '#ffe600', cabin: '#1a1208', wheel: '#222222' },
  night: { body: '#00e5ff', cabin: '#120018', wheel: '#ff2bd6' },
} as const satisfies TCarSkins;

export const treePalette = {
  day: {
    trunk: '#6a5648',
    pine: '#2f5c36',
    pineDark: '#243f2a',
    pineLight: '#3a6e40',
    broadleaf: '#3d7340',
    broadleafLight: '#4a8648',
  },
  night: {
    trunk: '#3d3228',
    pine: '#2a4034',
    pineDark: '#1e2e26',
    pineLight: '#355044',
    broadleaf: '#2e4034',
    broadleafLight: '#3a4e40',
  },
} as const satisfies TTreePalette;

export const crowdPalette = {
  shirtDay: [
    '#e63946',
    '#1d3557',
    '#2a9d8f',
    '#f4a261',
    '#264653',
    '#8338ec',
    '#f1faee',
    '#ffd60a',
    '#06d6a0',
    '#118ab2',
    '#ffffff',
    '#1a1a1a',
    '#c1121f',
    '#fca311',
  ],
  shirtNight: [
    '#e63946',
    '#1d3557',
    '#2a9d8f',
    '#f4a261',
    '#264653',
    '#8338ec',
    '#f1faee',
    '#ffd60a',
    '#06d6a0',
    '#118ab2',
    '#ff2bd6',
    '#00e5ff',
    '#ff6b35',
    '#c77dff',
    '#ffffff',
    '#1a1a1a',
  ],
  skin: ['#f0d4b8', '#e0b090', '#c6865a', '#8d5524', '#f5c9a0'],
  pantsDay: ['#4a5a72', '#3d4a5c', '#2f3b4c', '#5a6578'],
  pantsNight: ['#4a5a72', '#3d4a5c', '#2f3b4c', '#5a6578', '#1b2838', '#3b2f4a'],
  hair: ['#1a1410', '#3b2f2f', '#5c4033', '#2c2c2c', '#6b4423'],
  cap: ['#1a1a1a', '#c1121f', '#1d3557', '#ffffff', '#fca311', '#264653', '#e63946'],
  meshBase: '#ffffff',
  emissiveOff: '#000000',
  skinEmissiveNight: '#c4a080',
} as const satisfies TCrowdPalette;

export const tribunePalette = {
  day: {
    structure: '#c4bbb0',
    step: '#d2c9bc',
    platform: '#c9c0b4',
    seat: '#c4a574',
    metal: '#9aa3ab',
  },
  night: {
    structure: '#a39c92',
    step: '#aea79c',
    platform: '#989188',
    seat: '#a88a64',
    metal: '#868e96',
    rail: '#a2aab0',
  },
  emissiveOff: '#000000',
} as const satisfies TTribunePalette;

export const vehiclePalette = {
  headlight: '#fff8e0',
  glass: '#88ccff',
  brake: '#ff3333',
  brakeEmissive: '#ff0a0a',
  reverseEmissive: '#f2f5ff',
  headlamp: '#ffffcc',
  headlampEmissive: '#ffffaa',
  rim: '#aaaaaa',
} as const satisfies TVehiclePalette;

export const startLightPalette = {
  idle: '#334155',
  red: '#ff2244',
  amber: '#ffcc00',
  green: '#33ff66',
  steel: '#2a2e36',
  steelDark: '#15181e',
  housing: '#0c0e12',
  bezel: '#3a3f4a',
  floodLight: '#fff2d6',
} as const satisfies TStartLightPalette;

/** Муниципальный LED-фонарь (~3000K тёплый белый) */
export const streetLampPalette = {
  pole: '#2a2e36',
  arm: '#15181e',
  housing: '#0c0e12',
  lens: '#fff6d8',
  light: '#ffe9b8',
} as const satisfies TStreetLampPalette;

export const horizonSunStops = {
  core: [
    { stop: 0, color: 'rgba(255, 255, 245, 1)' },
    { stop: 0.22, color: 'rgba(255, 245, 200, 1)' },
    { stop: 0.48, color: 'rgba(255, 228, 150, 1)' },
    { stop: 0.75, color: 'rgba(255, 205, 110, 0.9)' },
    { stop: 1, color: 'rgba(255, 180, 80, 0)' },
  ],
  corona: [
    { stop: 0, color: 'rgba(255, 200, 90, 0.45)' },
    { stop: 0.28, color: 'rgba(255, 160, 50, 0.28)' },
    { stop: 0.62, color: 'rgba(255, 115, 30, 0.12)' },
    { stop: 1, color: 'rgba(255, 90, 20, 0)' },
  ],
  glow: [
    { stop: 0, color: 'rgba(255, 175, 85, 0.28)' },
    { stop: 0.4, color: 'rgba(255, 135, 45, 0.1)' },
    { stop: 1, color: 'rgba(255, 100, 30, 0)' },
  ],
} as const satisfies THorizonSunStops;

export const horizonMoonStops = {
  disk: [
    { stop: 0, color: 'rgba(248, 246, 238, 1)' },
    { stop: 0.55, color: 'rgba(220, 218, 208, 0.98)' },
    { stop: 0.82, color: 'rgba(185, 188, 198, 0.85)' },
    { stop: 1, color: 'rgba(140, 148, 168, 0)' },
  ],
  limb: [
    { stop: 0, color: 'rgba(0, 0, 0, 0)' },
    { stop: 1, color: 'rgba(40, 50, 80, 0.22)' },
  ],
  glow: [
    { stop: 0, color: 'rgba(210, 220, 245, 0.2)' },
    { stop: 0.18, color: 'rgba(195, 205, 235, 0.13)' },
    { stop: 0.36, color: 'rgba(175, 190, 225, 0.075)' },
    { stop: 0.55, color: 'rgba(155, 175, 215, 0.038)' },
    { stop: 0.72, color: 'rgba(140, 160, 205, 0.016)' },
    { stop: 0.88, color: 'rgba(125, 145, 195, 0.004)' },
    { stop: 1, color: 'rgba(120, 140, 190, 0)' },
  ],
  halo: [
    { stop: 0, color: 'rgba(230, 235, 250, 0.1)' },
    { stop: 0.2, color: 'rgba(210, 220, 245, 0.065)' },
    { stop: 0.42, color: 'rgba(185, 200, 235, 0.032)' },
    { stop: 0.65, color: 'rgba(160, 180, 220, 0.012)' },
    { stop: 0.85, color: 'rgba(145, 165, 210, 0.003)' },
    { stop: 1, color: 'rgba(140, 160, 210, 0)' },
  ],
} as const satisfies THorizonMoonStops;

/** Нейтрали и one-off сцены */
export const scenePalette = {
  white: '#ffffff',
  black: '#000000',
  checkerDark: '#111111',
  sunDay: '#fff8f0',
  sunNight: '#ffffff',
  obstacle: '#1c1c1e',
  skidMark: '#1c1c1e',
} as const satisfies TScenePalette;

/** Красно-белые поребрики */
export const kerbPalette = {
  red: '#d62828',
  white: '#f5f5f5',
} as const satisfies TKerbPalette;

/** Придорожные рекламные щиты (бумажный короб + gooseneck-подсветка) */
export const billboardPalette = {
  pole: '#3a404a',
  frame: '#c9c4b8',
  panelBack: '#8a867c',
  bolt: '#6b7280',
  floodArm: '#4a505a',
  floodHousing: '#2a2e36',
  floodBulbOff: '#3a3f48',
  floodBulbOn: '#fff6e0',
  floodLight: '#fff2d6',
  ads: {
    'torque-cola': {
      background: '#c41e3a',
      foreground: '#fff8f0',
      accent: '#ffcc33',
      muted: '#ffe8d6',
    },
    'apex-tires': {
      background: '#111318',
      foreground: '#f5f5f5',
      accent: '#ff4d1a',
      muted: '#a8adb8',
    },
    'nitro-donuts': {
      background: '#5b2cff',
      foreground: '#ffffff',
      accent: '#ff66cc',
      muted: '#d9cfff',
    },
    'pitstop-insurance': {
      background: '#0b3d5c',
      foreground: '#e8f4ff',
      accent: '#33ddaa',
      muted: '#9ec4de',
    },
    'for-rent': {
      background: '#d6d2c8',
      foreground: '#2a2a2e',
      accent: '#d6d2c8',
      muted: '#2a2a2e',
    },
  },
} as const satisfies TBillboardPalette;

/** Hex-цвет (#rgb / #rrggbb / #rrggbbaa) */
export type THexColor = `#${string}`;

/** rgb() / rgba() — стопы градиентов горизонта */
export type TRgbaColor = `rgb(${string})` | `rgba(${string})`;

/** CSS-цвет для UI-токенов и 3D-материалов */
export type TCssColor = THexColor | TRgbaColor;

/** Стоп радиального градиента (canvas / horizon) */
export type TRadialColorStop = {
  /** Позиция стопа 0..1 */
  stop: number;
  /** Цвет стопа */
  color: TCssColor;
};

/** UI-токены одной темы (мапятся в CSS-переменные --bg, --fg, …) */
export type TUiThemeColors = {
  /** Фон страницы */
  bg: TCssColor;
  /** Основной текст */
  fg: TCssColor;
  /** Приглушённый текст */
  muted: TCssColor;
  /** Поверхность карточек/панелей */
  surface: TCssColor;
  /** Hover поверхности */
  'surface-hover': TCssColor;
  /** Границы */
  border: TCssColor;
  /** Акцент */
  accent: TCssColor;
  /** Текст на accent */
  'accent-fg': TCssColor;
  /** Ошибки / danger */
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
  /** Светлая тема */
  light: TUiThemeColors;
  /** Тёмная тема */
  dark: TUiThemeColors;
};

/** Доп. UI-цвета, не зависящие от light/dark */
export type TUiChrome = {
  /** Текст на жёлтом активном табе */
  onYellow: TCssColor;
  /** Полосы finish wipe (тёмная) */
  finishWipeDark: TCssColor;
  /** Полосы finish wipe (светлая) */
  finishWipeLight: TCssColor;
};

export type TUiChromeToken = keyof TUiChrome;

/** Палитра материалов трассы (shape совместим с TTrackPalette) */
export type TTrackPaletteColors = {
  /** Цвет неба / clearColor */
  sky: TCssColor;
  /** Цвет тумана */
  fog: TCssColor;
  /** Грунт вокруг трассы */
  ground: TCssColor;
  /** Асфальт */
  road: TCssColor;
  /** Стены */
  wall: TCssColor;
  /** Акцент разметки / неона */
  accent: TCssColor;
  /** Дорога на миникарте */
  minimapRoad: TCssColor;
  /** Стены на миникарте */
  minimapWall: TCssColor;
  /** Фон миникарты */
  minimapBg: TCssColor;
};

export type TTrackPaletteToken = keyof TTrackPaletteColors;
export type TTrackPaletteId = 'coastal' | 'night';

export type TTrackPalettes = Record<TTrackPaletteId, TTrackPaletteColors>;

/** Окраска машины (shape совместим с TCarSkin) */
export type TCarSkinColors = {
  /** Кузов */
  body: TCssColor;
  /** Кабина */
  cabin: TCssColor;
  /** Шины */
  wheel: TCssColor;
};

export type TCarSkinToken = keyof TCarSkinColors;
export type TCarSkins = Record<TTrackPaletteId, TCarSkinColors>;

export type TTreeTimeOfDayColors = {
  /** Ствол */
  trunk: TCssColor;
  /** Крона сосны */
  pine: TCssColor;
  /** Крона лиственного */
  broadleaf: TCssColor;
};

export type TTreePaletteToken = keyof TTreeTimeOfDayColors;

export type TTreePalette = {
  /** Дневные цвета деревьев */
  day: TTreeTimeOfDayColors;
  /** Ночные цвета деревьев */
  night: TTreeTimeOfDayColors;
};

export type TCrowdPalette = {
  /** Футболки днём */
  shirtDay: readonly TCssColor[];
  /** Футболки ночью */
  shirtNight: readonly TCssColor[];
  /** Оттенки кожи */
  skin: readonly TCssColor[];
  /** Штаны днём */
  pantsDay: readonly TCssColor[];
  /** Штаны ночью */
  pantsNight: readonly TCssColor[];
  /** Волосы / тёмные кепки */
  hair: readonly TCssColor[];
  /** Кепки (гоночные цвета) */
  cap: readonly TCssColor[];
  /** Базовый цвет меша до instanceColor */
  meshBase: TCssColor;
  /** Выключенный emissive */
  emissiveOff: TCssColor;
  /** Emissive кожи ночью */
  skinEmissiveNight: TCssColor;
};

export type TTribuneDayColors = {
  /** Каркас трибуны */
  structure: TCssColor;
  /** Ступени */
  step: TCssColor;
  /** Платформа */
  platform: TCssColor;
};

export type TTribuneNightColors = TTribuneDayColors & {
  /** Перила / навес ночью */
  rail: TCssColor;
};

export type TTribunePalette = {
  /** Дневные цвета трибуны */
  day: TTribuneDayColors;
  /** Ночные цвета трибуны */
  night: TTribuneNightColors;
  /** Выключенный emissive */
  emissiveOff: TCssColor;
};

export type TVehiclePalette = {
  /** Цвет света фар */
  headlight: TCssColor;
  /** Стекло кабины */
  glass: TCssColor;
  /** Стоп-сигналы */
  brake: TCssColor;
  /** Emissive стоп-сигналов */
  brakeEmissive: TCssColor;
  /** Корпус фары */
  headlamp: TCssColor;
  /** Emissive фары */
  headlampEmissive: TCssColor;
  /** Диски */
  rim: TCssColor;
};

export type TVehiclePaletteToken = keyof TVehiclePalette;

export type TStartLightPalette = {
  /** Лампа выключена */
  idle: TCssColor;
  /** Красный (countdown F1) */
  red: TCssColor;
  /** Жёлтый (зарезервирован, не на gantry) */
  amber: TCssColor;
  /** Зелёный (зарезервирован; старт F1 = гашение красных) */
  green: TCssColor;
  /** Металл столбов и балки gantry */
  steel: TCssColor;
  /** Тёмный металл / emissive базы конструкции */
  steelDark: TCssColor;
  /** Корпус панели ламп */
  housing: TCssColor;
  /** Ободок ниши лампы */
  bezel: TCssColor;
};

export type TStartLightToken = keyof TStartLightPalette;

export type TStreetLampPalette = {
  /** Ствол столба */
  pole: TCssColor;
  /** Кронштейн */
  arm: TCssColor;
  /** Корпус плафона */
  housing: TCssColor;
  /** Стекло / линза */
  lens: TCssColor;
  /** Цвет SpotLight / PointLight */
  light: TCssColor;
};

export type TStreetLampToken = keyof TStreetLampPalette;

export type THorizonSunStops = {
  /** Ядро солнца */
  core: readonly TRadialColorStop[];
  /** Корона */
  corona: readonly TRadialColorStop[];
  /** Внешнее свечение */
  glow: readonly TRadialColorStop[];
};

export type THorizonMoonStops = {
  /** Диск луны */
  disk: readonly TRadialColorStop[];
  /** Край диска */
  limb: readonly TRadialColorStop[];
  /** Внешнее свечение */
  glow: readonly TRadialColorStop[];
  /** Ореол */
  halo: readonly TRadialColorStop[];
};

export type TScenePalette = {
  /** Белый (разметка) */
  white: TCssColor;
  /** Чёрный */
  black: TCssColor;
  /** Тёмная клетка шахматки */
  checkerDark: TCssColor;
  /** Цвет дневного солнца */
  sunDay: TCssColor;
  /** Цвет ночного света */
  sunNight: TCssColor;
  /** Цвет препятствий (шины) */
  obstacle: TCssColor;
  /** Следы резины на асфальте */
  skidMark: TCssColor;
};

export type TScenePaletteToken = keyof TScenePalette;

export type TKerbPalette = {
  /** Красная полоса поребрика */
  red: TCssColor;
  /** Белая полоса поребрика */
  white: TCssColor;
};

export type TBillboardAdColors = {
  /** Фон панели */
  background: TCssColor;
  /** Основной текст / бренд */
  foreground: TCssColor;
  /** Акцент (полоса, логотип-пятно) */
  accent: TCssColor;
  /** Вторичный текст / слоган */
  muted: TCssColor;
};

export type TBillboardPalette = {
  /** Стальные столбы */
  pole: TCssColor;
  /** Рамка панели (светлый короб бумажного щита) */
  frame: TCssColor;
  /** Тыльная сторона панели */
  panelBack: TCssColor;
  /** Крепёж / болты */
  bolt: TCssColor;
  /** Труба кронштейна подсветки */
  floodArm: TCssColor;
  /** Корпус прожектора */
  floodHousing: TCssColor;
  /** Колба выключена */
  floodBulbOff: TCssColor;
  /** Колба включена */
  floodBulbOn: TCssColor;
  /** Цвет SpotLight */
  floodLight: TCssColor;
  /** Цвета макетов по adId */
  ads: {
    'torque-cola': TBillboardAdColors;
    'apex-tires': TBillboardAdColors;
    'nitro-donuts': TBillboardAdColors;
    'pitstop-insurance': TBillboardAdColors;
    'for-rent': TBillboardAdColors;
  };
};

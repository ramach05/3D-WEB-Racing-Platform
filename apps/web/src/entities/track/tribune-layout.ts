import type { TOrientedBox, TStartTribuneSide, TVec3 } from './config.types';

/** Общие размеры трибун — визуал и зона запрета деревьев из одних чисел */
export const TRIBUNE_ROWS = 5;
export const ROW_HEIGHT = 0.65;
export const ROW_DEPTH = 0.75;
/** Геометрия чуть шире шага — непрерывные ступени; зрители укладываются в sectionPitch */
export const SECTION_WIDTH = 8;
export const SECTION_PITCH = 6;
export const SECTION_Z_OFFSETS = [-SECTION_PITCH, 0, SECTION_PITCH] as const;
export const WALL_OFFSET = 0.5;
export const TRIBUNE_MARGIN = 2.5;
/** Запас под кроны + цоколь/лестницы вокруг площадки трибун */
export const TREE_EXCLUSION_PADDING = 5;

/** Цоколь: толщина плиты, уходящей ниже ROAD_TOP_Y */
export const FOUNDATION_THICKNESS = 0.28;
/** Выступ цоколя за платформу по X/Z */
export const FOUNDATION_OVERHANG = 0.25;

/** Сечение стойки навеса (тонкая стальная колонна) */
export const CANOPY_POST_SIZE = 0.14;
/** Задние стойки на секцию (±Z, опционально центр) */
export const CANOPY_POSTS_PER_SECTION = 3;
/** Y-центр навеса относительно верхней кромки заднего ряда */
export const CANOPY_CENTER_Y_OFFSET = 1.25;
/** Толщина плиты навеса */
export const CANOPY_THICKNESS = 0.08;

/** Высота трубчатого поручня над поверхностью ряда */
export const RAIL_HEIGHT = 0.92;
/** Диаметр трубы ограждения */
export const RAIL_TUBE = 0.055;
/** Шаг вертикальных стоек ограждения */
export const RAIL_POST_SPACING = 1.55;
/** Насколько стойка утоплена в бетон */
export const RAIL_POST_EMBED = 0.08;

/** Ширина лестничного пролёта у торца */
export const STAIR_WIDTH = 1.15;
/** Глубина одной ступени лестницы (= глубина ряда) */
export const STAIR_RUN = ROW_DEPTH;
/** Лестница вплотную к торцу секции (без зазора) */
export const STAIR_GAP = 0;
/** Низкий бортик с внешней стороны лестницы (не глухая стена) */
export const STAIR_CURB_HEIGHT = 0.16;
export const STAIR_CURB_THICKNESS = 0.07;

/** Высота планки сиденья */
export const SEAT_PLANK_HEIGHT = 0.07;
/** Глубина планки сиденья */
export const SEAT_PLANK_DEPTH = 0.38;
/** Высота спинки скамьи */
export const SEAT_BACK_HEIGHT = 0.32;
/** Толщина спинки */
export const SEAT_BACK_THICKNESS = 0.04;

/** Низкая задняя панель (не стена — только фасция) */
export const FASCIA_HEIGHT = 0.42;
export const FASCIA_THICKNESS = 0.08;

/** Y верхней кромки ряда (локально к ROAD_TOP_Y группы) */
export const rowTopY = (row: number) => (row + 1) * ROW_HEIGHT;

/** Y центра навеса */
export const canopyCenterY = () => rowTopY(TRIBUNE_ROWS - 1) + CANOPY_CENTER_Y_OFFSET;

/** Нижняя грань навеса */
export const canopyUndersideY = () => canopyCenterY() - CANOPY_THICKNESS / 2;

/**
 * Знак стороны в локале финишной линии. Визуал и коллайдеры трибун повернуты на
 * `startFinishLine.rotationY` = yaw вдоль РОСТА индекса centerline, а заезд идет
 * против него (race-direction.ts). Значит машина на старте смотрит в локальный −Z,
 * ее левая сторона — локальный −X. Отсюда `left` → −1.
 */
export const tribuneSideSign = (side: TStartTribuneSide): number => (side === 'left' ? -1 : 1);

type TBuildTribuneExclusionOptions = {
  /** Линия старт/финиш — якорь ориентации */
  startFinishLine: TOrientedBox;
  /** Ширина дороги */
  roadWidth: number;
  /** Сторона трибун относительно движения */
  side: TStartTribuneSide;
};

/** Ориентированная коробка вокруг зрительских трибун (мир старт/финиша). */
export const buildTribuneTreeExclusionZone = ({
  startFinishLine,
  roadWidth,
  side,
}: TBuildTribuneExclusionOptions): TOrientedBox => {
  const sideSign = tribuneSideSign(side);
  const tribuneInnerLocalX = sideSign * (roadWidth / 2 + WALL_OFFSET + TRIBUNE_MARGIN);
  const tribuneDepth = TRIBUNE_ROWS * ROW_DEPTH;
  const centerLocalX = tribuneInnerLocalX + sideSign * (tribuneDepth / 2);
  const halfSpanZ =
    SECTION_PITCH + SECTION_WIDTH / 2 + STAIR_WIDTH + TREE_EXCLUSION_PADDING;
  const halfDepthX = tribuneDepth / 2 + FOUNDATION_OVERHANG + TREE_EXCLUSION_PADDING;

  const cos = Math.cos(startFinishLine.rotationY);
  const sin = Math.sin(startFinishLine.rotationY);
  const worldX = startFinishLine.position[0] + centerLocalX * cos;
  const worldZ = startFinishLine.position[2] - centerLocalX * sin;

  return {
    position: [worldX, 0, worldZ] as TVec3,
    size: [halfDepthX * 2, 8, halfSpanZ * 2] as TVec3,
    rotationY: startFinishLine.rotationY,
  };
};

/** X центра ряда трибуны */
export const tribuneRowCenterX = (tribuneInnerX: number, sideSign: number, row: number) =>
  tribuneInnerX + sideSign * (row * ROW_DEPTH + ROW_DEPTH / 2);

export type TTribuneCanopyPost = {
  /** Центр стойки [x, y, z] в локале секции (y от ROAD_TOP_Y) */
  position: TVec3;
  /** Высота стойки */
  height: number;
};

/**
 * Задние стальные колонны навеса (±Z + центр) — фасад открыт.
 */
export const buildTribuneCanopyPosts = (
  tribuneInnerX: number,
  sideSign: number,
): TTribuneCanopyPost[] => {
  const underside = canopyUndersideY();
  const backX = tribuneInnerX + sideSign * (TRIBUNE_ROWS * ROW_DEPTH - CANOPY_POST_SIZE * 0.5);
  const zInset = SECTION_WIDTH / 2 - CANOPY_POST_SIZE * 0.5;
  const zPositions = [-zInset, 0, zInset] as const;
  const baseY = 0;
  const height = Math.max(0.5, underside - baseY);

  return zPositions.map((z) => ({
    position: [backX, baseY + height / 2, z] as TVec3,
    height,
  }));
};

export type TTribuneSeatPlank = {
  /** Центр планки [x, y, z] */
  position: TVec3;
  /** Размеры [depthX, height, widthZ] */
  size: TVec3;
};

/** Сиденья и спинки на каждом ряду секции */
export const buildTribuneSeatPlanks = (
  tribuneInnerX: number,
  sideSign: number,
): { seats: TTribuneSeatPlank[]; backs: TTribuneSeatPlank[] } => {
  const seats: TTribuneSeatPlank[] = [];
  const backs: TTribuneSeatPlank[] = [];
  for (let row = 0; row < TRIBUNE_ROWS; row += 1) {
    const top = rowTopY(row);
    const centerX = tribuneRowCenterX(tribuneInnerX, sideSign, row);
    seats.push({
      position: [centerX, top + SEAT_PLANK_HEIGHT / 2, 0],
      size: [SEAT_PLANK_DEPTH, SEAT_PLANK_HEIGHT, SECTION_WIDTH - 0.35],
    });
    // Спинка у задней кромки ряда
    backs.push({
      position: [
        centerX + sideSign * (SEAT_PLANK_DEPTH / 2 - SEAT_BACK_THICKNESS / 2),
        top + SEAT_PLANK_HEIGHT + SEAT_BACK_HEIGHT / 2,
        0,
      ],
      size: [SEAT_BACK_THICKNESS, SEAT_BACK_HEIGHT, SECTION_WIDTH - 0.45],
    });
  }
  return { seats, backs };
};

export type TTribuneRailPart = {
  /** Центр [x, y, z] */
  position: TVec3;
  /** Размеры [sx, sy, sz] — unit box до масштаба */
  size: TVec3;
  /** Euler XYZ (рад), по умолчанию 0 */
  rotation?: TVec3;
};

/**
 * Трубчатое ограждение заднего ряда: поручень + стойки, утопленные в бетон.
 */
export const buildTribuneBackRails = (
  tribuneInnerX: number,
  sideSign: number,
): TTribuneRailPart[] => {
  const top = rowTopY(TRIBUNE_ROWS - 1);
  const railX =
    tribuneRowCenterX(tribuneInnerX, sideSign, TRIBUNE_ROWS - 1) +
    sideSign * (ROW_DEPTH / 2 - RAIL_TUBE);
  const parts: TTribuneRailPart[] = [];
  const half = SECTION_WIDTH / 2 - 0.12;
  const spanZ = half * 2;

  // Горизонтальный поручень и средняя перекладина — ровно между крайними стойками
  parts.push({
    position: [railX, top + RAIL_HEIGHT, 0],
    size: [RAIL_TUBE, RAIL_TUBE, spanZ],
  });
  parts.push({
    position: [railX, top + RAIL_HEIGHT * 0.48, 0],
    size: [RAIL_TUBE * 0.85, RAIL_TUBE * 0.85, spanZ],
  });

  const count = Math.max(2, Math.round(SECTION_WIDTH / RAIL_POST_SPACING) + 1);
  const postHeight = RAIL_HEIGHT + RAIL_POST_EMBED;
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const z = -half + t * spanZ;
    parts.push({
      position: [railX, top - RAIL_POST_EMBED + postHeight / 2, z],
      size: [RAIL_TUBE, postHeight, RAIL_TUBE],
    });
  }

  return parts;
};

export type TTribuneStairStep = {
  /** Центр ступени [x, y, z] */
  position: TVec3;
  /** Размеры [depthX, height, widthZ] */
  size: TVec3;
};

export type TTribuneStairStringer = {
  /** Центр бортика */
  position: TVec3;
  /** Размеры */
  size: TVec3;
};

type TBuildTribuneStairsOptions = {
  tribuneInnerX: number;
  sideSign: number;
  /** Индекс секции в SECTION_Z_OFFSETS */
  sectionIndex: number;
};

/** Знак внешнего торца (−1 / +1) или null, если секция не крайняя */
export const tribuneOuterEndSign = (sectionIndex: number): -1 | 1 | null => {
  const lastIndex = SECTION_Z_OFFSETS.length - 1;
  if (sectionIndex === 0) return -1;
  if (sectionIndex === lastIndex) return 1;
  return null;
};

/**
 * Лестницы только на внешних торцах крайних секций — вплотную к рядам.
 */
export const buildTribuneStairs = ({
  tribuneInnerX,
  sideSign,
  sectionIndex,
}: TBuildTribuneStairsOptions): TTribuneStairStep[] => {
  const outerZSign = tribuneOuterEndSign(sectionIndex);
  if (outerZSign == null) return [];

  const stairLocalZ = outerZSign * (SECTION_WIDTH / 2 + STAIR_WIDTH / 2 + STAIR_GAP);
  const steps: TTribuneStairStep[] = [];

  for (let row = 0; row < TRIBUNE_ROWS; row += 1) {
    // Ступень от земли до поверхности ряда — монолитный блок (не «полка в воздухе»)
    const height = (row + 1) * ROW_HEIGHT;
    steps.push({
      position: [
        tribuneRowCenterX(tribuneInnerX, sideSign, row),
        height / 2,
        stairLocalZ,
      ],
      size: [STAIR_RUN, height, STAIR_WIDTH],
    });
  }

  return steps;
};

/**
 * Низкий бортик вдоль внешней стороны лестницы (вместо глухой бетонной стены).
 */
export const buildTribuneStairStringer = ({
  tribuneInnerX,
  sideSign,
  sectionIndex,
}: TBuildTribuneStairsOptions): TTribuneStairStringer | null => {
  const outerZSign = tribuneOuterEndSign(sectionIndex);
  if (outerZSign == null) return null;

  const stairLocalZ = outerZSign * (SECTION_WIDTH / 2 + STAIR_WIDTH / 2 + STAIR_GAP);
  const depth = TRIBUNE_ROWS * ROW_DEPTH;
  const platformCenterX = tribuneInnerX + (sideSign * depth) / 2;

  return {
    position: [
      platformCenterX,
      STAIR_CURB_HEIGHT / 2,
      stairLocalZ + outerZSign * (STAIR_WIDTH / 2 + STAIR_CURB_THICKNESS / 2),
    ],
    size: [depth + 0.05, STAIR_CURB_HEIGHT, STAIR_CURB_THICKNESS],
  };
};

/**
 * Ограждение лестницы: стойки на каждой ступени + наклонный поручень (без «палки в воздухе»).
 */
export const buildTribuneStairRails = (
  stairSteps: readonly TTribuneStairStep[],
  _tribuneInnerX: number,
  _sideSign: number,
): TTribuneRailPart[] => {
  if (stairSteps.length < 2) return [];
  const first = stairSteps[0];
  const last = stairSteps[stairSteps.length - 1];
  if (!first || !last) return [];

  const zSign = Math.sign(first.position[2]) || 1;
  const railZ = first.position[2] + zSign * (STAIR_WIDTH / 2 - RAIL_TUBE * 0.6);
  const parts: TTribuneRailPart[] = [];

  const treadTopY = (step: TTribuneStairStep) => step.position[1] + step.size[1] / 2;

  // Стойки на каждой ступени, утоплены в бетон
  for (const step of stairSteps) {
    const top = treadTopY(step);
    const postHeight = RAIL_HEIGHT + RAIL_POST_EMBED;
    parts.push({
      position: [step.position[0], top - RAIL_POST_EMBED + postHeight / 2, railZ],
      size: [RAIL_TUBE, postHeight, RAIL_TUBE],
    });
  }

  // Наклонный поручень и средняя перекладина между первой и последней стойкой
  const x0 = first.position[0];
  const x1 = last.position[0];
  const y0 = treadTopY(first) + RAIL_HEIGHT;
  const y1 = treadTopY(last) + RAIL_HEIGHT;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.hypot(dx, dy);
  const angleZ = Math.atan2(dy, dx);

  parts.push({
    position: [(x0 + x1) / 2, (y0 + y1) / 2, railZ],
    size: [length, RAIL_TUBE, RAIL_TUBE],
    rotation: [0, 0, angleZ],
  });

  const midY0 = treadTopY(first) + RAIL_HEIGHT * 0.48;
  const midY1 = treadTopY(last) + RAIL_HEIGHT * 0.48;
  const midDy = midY1 - midY0;
  const midLen = Math.hypot(dx, midDy);
  const midAngle = Math.atan2(midDy, dx);
  parts.push({
    position: [(x0 + x1) / 2, (midY0 + midY1) / 2, railZ],
    size: [midLen, RAIL_TUBE * 0.85, RAIL_TUBE * 0.85],
    rotation: [0, 0, midAngle],
  });

  return parts;
};

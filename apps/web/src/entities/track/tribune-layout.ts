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
/** Запас под кроны вокруг площадки трибун */
export const TREE_EXCLUSION_PADDING = 4;

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
  const sideSign = side === 'left' ? 1 : -1;
  const tribuneInnerLocalX = sideSign * (roadWidth / 2 + WALL_OFFSET + TRIBUNE_MARGIN);
  const tribuneDepth = TRIBUNE_ROWS * ROW_DEPTH;
  const centerLocalX = tribuneInnerLocalX + sideSign * (tribuneDepth / 2);
  const halfSpanZ =
    SECTION_PITCH + SECTION_WIDTH / 2 + TREE_EXCLUSION_PADDING;
  const halfDepthX = tribuneDepth / 2 + TREE_EXCLUSION_PADDING;

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

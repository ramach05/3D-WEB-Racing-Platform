import { useEffect, useMemo } from 'react';
import { MeshStandardMaterial } from 'three';
import type { TOrientedBox, TStartTribuneSide, TTrackPalette } from '@/entities/track';
import {
  ROW_DEPTH,
  ROW_HEIGHT,
  SECTION_PITCH,
  SECTION_WIDTH,
  SECTION_Z_OFFSETS,
  TRIBUNE_MARGIN,
  TRIBUNE_ROWS,
  WALL_OFFSET,
} from '@/entities/track';
import { tribunePalette } from '@/shared/config';
import { getSharedConcreteTexture } from '@/widgets/race-canvas/lib/concrete-texture';
import { buildSpectatorSeats, SpectatorCrowd } from './spectator-crowd';

type TTrackTribunesProps = {
  /** Ориентированный бокс линии старт/финиш */
  line: TOrientedBox;
  /** Ширина дороги */
  roadWidth: number;
  /** Палитра трассы */
  palette: TTrackPalette;
  /** Сторона трибуны относительно старта */
  side: TStartTribuneSide;
  /** Ночной режим освещения */
  isNight: boolean;
  /** Пауза анимации толпы */
  paused: boolean;
};

const SPECTATORS_PER_SECTION = 30;
const ROAD_TOP_Y = 0.1;

type TTribuneMaterials = {
  platform: MeshStandardMaterial;
  stepEven: MeshStandardMaterial;
  stepOdd: MeshStandardMaterial;
  canopy: MeshStandardMaterial;
  seatRail: MeshStandardMaterial;
};

type TTribuneSectionProps = {
  /** Z-центр секции */
  sectionZ: number;
  /** Внутренний X трибуны */
  tribuneInnerX: number;
  /** Знак стороны (−1 / +1) */
  sideSign: number;
  /** Палитра трассы */
  palette: TTrackPalette;
  /** Ночной режим */
  isNight: boolean;
  /** Пауза анимации толпы */
  paused: boolean;
  /** Shared concrete-материалы секции */
  materials: TTribuneMaterials;
};

/** X центра ряда трибуны */
const rowCenterX = (tribuneInnerX: number, sideSign: number, row: number) =>
  tribuneInnerX + sideSign * (row * ROW_DEPTH + ROW_DEPTH / 2);

/** Y верхней кромки ряда */
const rowTopY = (row: number) => (row + 1) * ROW_HEIGHT;

type TTribuneNightLightsProps = {
  /** Внутренний X трибуны */
  tribuneInnerX: number;
  /** Знак стороны (−1 / +1) */
  sideSign: number;
  /** Z-центр секции */
  sectionZ: number;
  /** Accent-цвет неона */
  accent: string;
};

/** Только emissive neon-ленты (без PointLight — бюджет FPS Night City) */
const TribuneNightLights = ({ tribuneInnerX, sideSign, sectionZ, accent }: TTribuneNightLightsProps) => (
  <group position={[0, ROAD_TOP_Y, sectionZ]}>
    {Array.from({ length: TRIBUNE_ROWS }, (_, row) => (
      <mesh
        key={`row-emissive-${row}`}
        position={[
          rowCenterX(tribuneInnerX, sideSign, row) - sideSign * (ROW_DEPTH / 2 + 0.04),
          rowTopY(row) - 0.04,
          0,
        ]}
      >
        <boxGeometry args={[0.06, 0.08, SECTION_WIDTH - 0.2]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
    ))}
  </group>
);

/** Одна секция трибуны: ступени, перила, навес и зрители */
const TribuneSection = ({
  sectionZ,
  tribuneInnerX,
  sideSign,
  palette,
  isNight,
  paused,
  materials,
}: TTribuneSectionProps) => {
  const seats = useMemo(
    () =>
      buildSpectatorSeats({
        tribuneInnerX,
        sideSign,
        count: SPECTATORS_PER_SECTION,
        sectionWidth: SECTION_WIDTH,
        sectionPitch: SECTION_PITCH,
      }),
    [tribuneInnerX, sideSign],
  );

  const backRowX = rowCenterX(tribuneInnerX, sideSign, TRIBUNE_ROWS - 1);
  const backOuterX = tribuneInnerX + sideSign * TRIBUNE_ROWS * ROW_DEPTH;

  return (
    <group position={[0, ROAD_TOP_Y, sectionZ]}>
      <mesh
        position={[
          tribuneInnerX + (sideSign * TRIBUNE_ROWS * ROW_DEPTH) / 2,
          ROW_HEIGHT / 2 - 0.02,
          0,
        ]}
        receiveShadow
        material={materials.platform}
        dispose={null}
      >
        <boxGeometry args={[TRIBUNE_ROWS * ROW_DEPTH + 0.4, ROW_HEIGHT, SECTION_WIDTH + 0.6]} />
      </mesh>

      {Array.from({ length: TRIBUNE_ROWS }, (_, row) => (
        <mesh
          key={`step-${row}`}
          position={[
            rowCenterX(tribuneInnerX, sideSign, row),
            row * ROW_HEIGHT + ROW_HEIGHT / 2,
            0,
          ]}
          castShadow
          receiveShadow
          material={row % 2 === 0 ? materials.stepEven : materials.stepOdd}
          dispose={null}
        >
          <boxGeometry args={[ROW_DEPTH, ROW_HEIGHT, SECTION_WIDTH]} />
        </mesh>
      ))}

      <mesh
        position={[backOuterX + sideSign * 0.06, rowTopY(TRIBUNE_ROWS - 1) + 0.42, 0]}
        castShadow
      >
        <boxGeometry args={[0.1, 0.85, SECTION_WIDTH + 0.3]} />
        <meshStandardMaterial
          color={palette.accent}
          emissive={palette.accent}
          emissiveIntensity={isNight ? 1.2 : 0.25}
          toneMapped={false}
          roughness={0.55}
        />
      </mesh>

      <mesh
        position={[
          tribuneInnerX + (sideSign * (TRIBUNE_ROWS * ROW_DEPTH + 0.5)) / 2,
          rowTopY(TRIBUNE_ROWS - 1) + 1.1,
          0,
        ]}
        castShadow
        receiveShadow
        material={materials.canopy}
        dispose={null}
      >
        <boxGeometry args={[TRIBUNE_ROWS * ROW_DEPTH + 0.8, 0.12, SECTION_WIDTH + 1]} />
      </mesh>

      <mesh
        position={[backRowX, rowTopY(TRIBUNE_ROWS - 1) + 0.43, 0]}
        castShadow
        material={materials.seatRail}
        dispose={null}
      >
        <boxGeometry args={[ROW_DEPTH, 0.08, SECTION_WIDTH + 0.2]} />
      </mesh>

      <SpectatorCrowd seats={seats} palette={palette} isNight={isNight} paused={paused} />
    </group>
  );
};

/** Трибуны с зрителями у линии старт/финиш (визуал; коллайдеры — TrackTribuneColliders) */
export const TrackTribunes = ({
  line,
  roadWidth,
  palette,
  side,
  isNight,
  paused,
}: TTrackTribunesProps) => {
  const sideSign = side === 'left' ? 1 : -1;
  const tribuneInnerX = sideSign * (roadWidth / 2 + WALL_OFFSET + TRIBUNE_MARGIN);

  const structureColor = isNight ? tribunePalette.night.structure : tribunePalette.day.structure;
  const stepColor = isNight ? tribunePalette.night.step : tribunePalette.day.step;
  const platformColor = isNight ? tribunePalette.night.platform : tribunePalette.day.platform;
  const canopyColor = isNight ? tribunePalette.night.rail : structureColor;

  const concreteMap = useMemo(() => getSharedConcreteTexture(256), []);

  const materials = useMemo((): TTribuneMaterials => {
    const shared = { map: concreteMap, metalness: 0 as const };
    return {
      platform: new MeshStandardMaterial({
        ...shared,
        color: platformColor,
        roughness: 0.95,
      }),
      stepEven: new MeshStandardMaterial({
        ...shared,
        color: stepColor,
        roughness: 0.92,
      }),
      stepOdd: new MeshStandardMaterial({
        ...shared,
        color: structureColor,
        roughness: 0.92,
      }),
      canopy: new MeshStandardMaterial({
        ...shared,
        color: canopyColor,
        roughness: 0.85,
        metalness: 0.15,
      }),
      seatRail: new MeshStandardMaterial({
        ...shared,
        color: stepColor,
        roughness: 0.9,
      }),
    };
  }, [concreteMap, platformColor, stepColor, structureColor, canopyColor]);

  // Освобождает shared-материалы трибун (текстура бетона — singleton, не dispose).
  useEffect(
    () => () => {
      materials.platform.dispose();
      materials.stepEven.dispose();
      materials.stepOdd.dispose();
      materials.canopy.dispose();
      materials.seatRail.dispose();
    },
    [materials],
  );

  return (
    <group position={[line.position[0], 0, line.position[2]]} rotation={[0, line.rotationY, 0]}>
      {SECTION_Z_OFFSETS.map((sectionZ) => (
        <TribuneSection
          key={`tribune-${sectionZ}`}
          sectionZ={sectionZ}
          tribuneInnerX={tribuneInnerX}
          sideSign={sideSign}
          palette={palette}
          isNight={isNight}
          paused={paused}
          materials={materials}
        />
      ))}
      {isNight
        ? SECTION_Z_OFFSETS.map((sectionZ) => (
            <TribuneNightLights
              key={`tribune-light-${sectionZ}`}
              tribuneInnerX={tribuneInnerX}
              sideSign={sideSign}
              sectionZ={sectionZ}
              accent={palette.accent}
            />
          ))
        : null}
    </group>
  );
};

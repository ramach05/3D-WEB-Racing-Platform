import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { PointLight } from 'three';
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
  /** Цвет стены / прожекторов */
  wall: string;
};

/** Прожекторы и подсветка рядов для ночной трассы */
const TribuneNightLights = ({
  tribuneInnerX,
  sideSign,
  sectionZ,
  accent,
  wall,
}: TTribuneNightLightsProps) => {
  const tribuneCenterX = tribuneInnerX + (sideSign * TRIBUNE_ROWS * ROW_DEPTH) / 2;
  const frontLightX = tribuneInnerX - sideSign * 1.8;
  const pulseA = useRef<PointLight>(null);
  const pulseB = useRef<PointLight>(null);

  // Пульсирует прожекторы трибуны по sin-времени.
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const breathe = 1 + Math.sin(t * 2.4 + sectionZ * 0.2) * 0.22;
    if (pulseA.current) {
      pulseA.current.intensity = 2.2 * breathe;
    }
    if (pulseB.current) {
      pulseB.current.intensity = 1.4 * (1 + Math.sin(t * 3.1 + 1.2) * 0.28);
    }
  });

  return (
    <group position={[0, ROAD_TOP_Y, sectionZ]}>
      <pointLight
        ref={pulseA}
        position={[frontLightX, 5.5, 0]}
        intensity={2.2}
        color={wall}
        distance={16}
      />
      <pointLight
        ref={pulseB}
        position={[tribuneCenterX, 4.8, 0]}
        intensity={1.4}
        color={accent}
        distance={13}
      />
      <pointLight
        position={[tribuneCenterX, 2.5, SECTION_WIDTH * 0.35]}
        intensity={0.9}
        color={wall}
        distance={10}
      />
      <pointLight
        position={[tribuneCenterX, 2.5, -SECTION_WIDTH * 0.35]}
        intensity={0.9}
        color={wall}
        distance={10}
      />

      {Array.from({ length: TRIBUNE_ROWS }, (_, row) => (
        <group key={`row-light-${row}`}>
          <mesh
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
              emissiveIntensity={1.4}
              toneMapped={false}
            />
          </mesh>
          <pointLight
            position={[
              rowCenterX(tribuneInnerX, sideSign, row) - sideSign * 0.35,
              rowTopY(row) + 0.15,
              0,
            ]}
            intensity={0.55}
            color={row % 2 === 0 ? accent : wall}
            distance={5.5}
          />
        </group>
      ))}
    </group>
  );
};

/** Одна секция трибуны: ступени, перила, навес и зрители */
const TribuneSection = ({
  sectionZ,
  tribuneInnerX,
  sideSign,
  palette,
  isNight,
  paused,
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

  const structureColor = isNight ? tribunePalette.night.structure : tribunePalette.day.structure;
  const stepColor = isNight ? tribunePalette.night.step : tribunePalette.day.step;
  const structureEmissive = isNight ? palette.wall : tribunePalette.emissiveOff;
  const structureEmissiveIntensity = isNight ? 0.12 : 0;
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
      >
        <boxGeometry args={[TRIBUNE_ROWS * ROW_DEPTH + 0.4, ROW_HEIGHT, SECTION_WIDTH + 0.6]} />
        <meshStandardMaterial
          color={isNight ? tribunePalette.night.platform : tribunePalette.day.platform}
          emissive={structureEmissive}
          emissiveIntensity={structureEmissiveIntensity}
          roughness={0.95}
        />
      </mesh>

      {Array.from({ length: TRIBUNE_ROWS }, (_, row) => {
        let emissive: string = tribunePalette.emissiveOff;
        if (isNight) {
          emissive = row % 2 === 0 ? palette.accent : palette.wall;
        }

        return (
          <mesh
            key={`step-${row}`}
            position={[
              rowCenterX(tribuneInnerX, sideSign, row),
              row * ROW_HEIGHT + ROW_HEIGHT / 2,
              0,
            ]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[ROW_DEPTH, ROW_HEIGHT, SECTION_WIDTH]} />
            <meshStandardMaterial
              color={row % 2 === 0 ? stepColor : structureColor}
              emissive={emissive}
              emissiveIntensity={isNight ? 0.1 : 0}
              roughness={0.92}
            />
          </mesh>
        );
      })}

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
      >
        <boxGeometry args={[TRIBUNE_ROWS * ROW_DEPTH + 0.8, 0.12, SECTION_WIDTH + 1]} />
        <meshStandardMaterial
          color={isNight ? tribunePalette.night.rail : structureColor}
          emissive={isNight ? palette.wall : tribunePalette.emissiveOff}
          emissiveIntensity={isNight ? 0.18 : 0}
          roughness={0.85}
          metalness={0.15}
        />
      </mesh>

      <mesh position={[backRowX, rowTopY(TRIBUNE_ROWS - 1) + 0.43, 0]} castShadow>
        <boxGeometry args={[ROW_DEPTH, 0.08, SECTION_WIDTH + 0.2]} />
        <meshStandardMaterial color={stepColor} roughness={0.9} />
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
        />
      ))}
      {isNight ? (
        <>
          {SECTION_Z_OFFSETS.map((sectionZ) => (
            <TribuneNightLights
              key={`tribune-light-${sectionZ}`}
              tribuneInnerX={tribuneInnerX}
              sideSign={sideSign}
              sectionZ={sectionZ}
              accent={palette.accent}
              wall={palette.wall}
            />
          ))}
        </>
      ) : null}
    </group>
  );
};

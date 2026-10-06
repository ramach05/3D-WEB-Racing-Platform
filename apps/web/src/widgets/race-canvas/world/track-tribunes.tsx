import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Euler,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type InstancedMesh,
  type Object3D,
  type SpotLight,
} from 'three';
import type { TOrientedBox, TStartTribuneSide, TTrackPalette } from '@/entities/track';
import {
  CANOPY_POST_SIZE,
  CANOPY_THICKNESS,
  FASCIA_HEIGHT,
  FASCIA_THICKNESS,
  FOUNDATION_OVERHANG,
  FOUNDATION_THICKNESS,
  ROW_DEPTH,
  ROW_HEIGHT,
  SECTION_PITCH,
  SECTION_WIDTH,
  SECTION_Z_OFFSETS,
  STAIR_WIDTH,
  TRIBUNE_MARGIN,
  TRIBUNE_ROWS,
  WALL_OFFSET,
  buildTribuneBackRails,
  buildTribuneCanopyPosts,
  buildTribuneSeatPlanks,
  buildTribuneStairRails,
  buildTribuneStairStringer,
  buildTribuneStairs,
  canopyCenterY,
  rowTopY,
  tribuneRowCenterX,
  tribuneSideSign,
} from '@/entities/track';
import { startLightPalette, tribunePalette } from '@/shared/config';
import { getSharedConcreteTexture } from '@/widgets/race-canvas/lib/concrete-texture';
import { getSharedCorrugatedMetalTexture } from '@/widgets/race-canvas/lib/metal-texture';
import {
  TRIBUNE_EDGE_SPOT,
  TRIBUNE_EDGE_Z_SIGNS,
  TRIBUNE_FLOOD,
  tribuneEdgeAimX,
  tribuneEdgeAimY,
  tribuneEdgeAimZ,
  tribuneEdgeLightX,
  tribuneEdgeLightY,
  tribuneEdgeLightZ,
} from '@/widgets/race-canvas/lib/tribune-night-lights';
import { getSharedWoodTexture } from '@/widgets/race-canvas/lib/wood-texture';
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
  seat: MeshStandardMaterial;
  metal: MeshStandardMaterial;
  structure: MeshStandardMaterial;
};

type TTribuneSectionProps = {
  /** Z-центр секции */
  sectionZ: number;
  /** Индекс секции в SECTION_Z_OFFSETS */
  sectionIndex: number;
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
  /** Shared-материалы секции */
  materials: TTribuneMaterials;
};

type TTribuneRowAccentsProps = {
  /** Внутренний X трибуны */
  tribuneInnerX: number;
  /** Знак стороны (−1 / +1) */
  sideSign: number;
  /** Z-центр секции */
  sectionZ: number;
  /** Accent-цвет неона */
  accent: string;
  /** Ночной glow лент */
  isOn: boolean;
};

type TTribuneEdgeFloodProps = {
  /** Внутренний X трибуны */
  tribuneInnerX: number;
  /** Знак стороны (−1 / +1) */
  sideSign: number;
  /** Знак края крыши по Z */
  zSign: number;
  /** Горит ли прожектор (ночь) */
  isOn: boolean;
};

/** Один краевой прожектор: корпус всегда; SpotLight только при isOn */
const TribuneEdgeFlood = ({ tribuneInnerX, sideSign, zSign, isOn }: TTribuneEdgeFloodProps) => {
  const spotRef = useRef<SpotLight>(null);
  const targetRef = useRef<Object3D>(null);

  const lightX = tribuneEdgeLightX(tribuneInnerX, sideSign);
  const lightY = tribuneEdgeLightY();
  const lightZ = tribuneEdgeLightZ(zSign);
  const aimX = tribuneEdgeAimX(tribuneInnerX, sideSign);
  const aimY = tribuneEdgeAimY();
  const aimZ = tribuneEdgeAimZ(zSign);

  // Привязывает Spot к точке на средних рядах (внутрь от края).
  useLayoutEffect(() => {
    if (!isOn) {
      return;
    }
    const spot = spotRef.current;
    const target = targetRef.current;
    if (!spot || !target) {
      return;
    }
    spot.target = target;
    spot.target.updateMatrixWorld();
  }, [isOn]);

  return (
    <group position={[lightX, lightY, lightZ]}>
      <mesh castShadow rotation={[0.7, 0, -sideSign * 0.12]}>
        <boxGeometry
          args={[TRIBUNE_FLOOD.housing.width, TRIBUNE_FLOOD.housing.height, TRIBUNE_FLOOD.housing.depth]}
        />
        <meshStandardMaterial
          color={startLightPalette.housing}
          metalness={0.55}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[0, -TRIBUNE_FLOOD.housing.height * 0.4, 0]}>
        <sphereGeometry args={[TRIBUNE_FLOOD.bulbRadius, 12, 10]} />
        <meshStandardMaterial
          color={isOn ? startLightPalette.floodLight : startLightPalette.idle}
          emissive={isOn ? startLightPalette.floodLight : '#000000'}
          emissiveIntensity={isOn ? TRIBUNE_FLOOD.lensEmissiveIntensity : 0}
          metalness={0.1}
          roughness={0.3}
          toneMapped={false}
        />
      </mesh>
      {isOn ? (
        <>
          <spotLight
            ref={spotRef}
            position={[0, -0.06, 0]}
            color={startLightPalette.floodLight}
            intensity={TRIBUNE_EDGE_SPOT.intensity}
            distance={TRIBUNE_EDGE_SPOT.distance}
            angle={TRIBUNE_EDGE_SPOT.angle}
            penumbra={TRIBUNE_EDGE_SPOT.penumbra}
            decay={TRIBUNE_EDGE_SPOT.decay}
            castShadow={false}
          />
          <object3D ref={targetRef} position={[aimX - lightX, aimY - lightY, aimZ - lightZ]} />
        </>
      ) : null}
    </group>
  );
};

/** Neon-ленты рядов: днём видны как accent, ночью — emissive */
const TribuneRowAccents = ({
  tribuneInnerX,
  sideSign,
  sectionZ,
  accent,
  isOn,
}: TTribuneRowAccentsProps) => (
  <group position={[0, ROAD_TOP_Y, sectionZ]}>
    {Array.from({ length: TRIBUNE_ROWS }, (_, row) => (
      <mesh
        key={`row-accent-${row}`}
        position={[
          tribuneRowCenterX(tribuneInnerX, sideSign, row) - sideSign * (ROW_DEPTH / 2 + 0.04),
          rowTopY(row) - 0.04,
          0,
        ]}
      >
        <boxGeometry args={[0.05, 0.06, SECTION_WIDTH - 0.4]} />
        <meshStandardMaterial
          color={accent}
          emissive={isOn ? accent : '#000000'}
          emissiveIntensity={isOn ? 1.4 : 0}
          toneMapped={false}
          roughness={0.45}
          metalness={0.15}
        />
      </mesh>
    ))}
  </group>
);

type TTribuneEdgeFloodsProps = {
  /** Внутренний X трибуны */
  tribuneInnerX: number;
  /** Знак стороны (−1 / +1) */
  sideSign: number;
  /** Горят ли прожекторы */
  isOn: boolean;
};

/** Два светильника на ±Z краях крыши (корпус всегда; свет — только isOn) */
const TribuneEdgeFloods = ({ tribuneInnerX, sideSign, isOn }: TTribuneEdgeFloodsProps) => (
  <group position={[0, ROAD_TOP_Y, 0]}>
    {TRIBUNE_EDGE_Z_SIGNS.map((zSign) => (
      <TribuneEdgeFlood
        key={`tribune-edge-${zSign}`}
        tribuneInnerX={tribuneInnerX}
        sideSign={sideSign}
        zSign={zSign}
        isOn={isOn}
      />
    ))}
  </group>
);

type TInstancedBoxItem = {
  position: readonly [number, number, number];
  size?: readonly [number, number, number];
  height?: number;
  rotation?: readonly [number, number, number];
};

type TInstancedBoxesProps = {
  /** Центры и размеры боксов */
  items: ReadonlyArray<TInstancedBoxItem>;
  /** Фиксированный размер XZ для стоек (высота из item.height) */
  fixedSizeXZ?: number;
  /** Материал */
  material: MeshStandardMaterial;
  /** Тень */
  castShadow?: boolean;
};

const _instPos = new Vector3();
const _instQuat = new Quaternion();
const _instScale = new Vector3();
const _instEuler = new Euler();

/** Один InstancedMesh из списка боксов (поддержка Euler-поворота) */
const InstancedBoxes = ({ items, fixedSizeXZ, material, castShadow = true }: TInstancedBoxesProps) => {
  const meshRef = useRef<InstancedMesh>(null);
  const count = items.length;

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;
    const matrix = new Matrix4();
    for (let i = 0; i < count; i += 1) {
      const item = items[i];
      if (!item) continue;
      const [x, y, z] = item.position;
      _instPos.set(x, y, z);
      if (item.rotation) {
        _instEuler.set(item.rotation[0], item.rotation[1], item.rotation[2], 'XYZ');
        _instQuat.setFromEuler(_instEuler);
      } else {
        _instQuat.identity();
      }
      if (item.size) {
        _instScale.set(item.size[0], item.size[1], item.size[2]);
      } else if (fixedSizeXZ != null && item.height != null) {
        _instScale.set(fixedSizeXZ, item.height, fixedSizeXZ);
      } else {
        continue;
      }
      matrix.compose(_instPos, _instQuat, _instScale);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [items, count, fixedSizeXZ]);

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      castShadow={castShadow}
      receiveShadow
      material={material}
      frustumCulled={false}
    >
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
};

/** Открытая секция грандстенда: бетон, дерево, сталь — без торцевых стен */
const TribuneSection = ({
  sectionZ,
  sectionIndex,
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

  const canopyPosts = useMemo(
    () => buildTribuneCanopyPosts(tribuneInnerX, sideSign),
    [tribuneInnerX, sideSign],
  );

  const { seats: seatPlanks, backs: seatBacks } = useMemo(
    () => buildTribuneSeatPlanks(tribuneInnerX, sideSign),
    [tribuneInnerX, sideSign],
  );

  const woodParts = useMemo(() => [...seatPlanks, ...seatBacks], [seatPlanks, seatBacks]);

  const stairSteps = useMemo(
    () =>
      buildTribuneStairs({
        tribuneInnerX,
        sideSign,
        sectionIndex,
      }),
    [tribuneInnerX, sideSign, sectionIndex],
  );

  const stairStringer = useMemo(
    () =>
      buildTribuneStairStringer({
        tribuneInnerX,
        sideSign,
        sectionIndex,
      }),
    [tribuneInnerX, sideSign, sectionIndex],
  );

  const railParts = useMemo(() => {
    const back = buildTribuneBackRails(tribuneInnerX, sideSign);
    const stair = buildTribuneStairRails(stairSteps, tribuneInnerX, sideSign);
    return [...back, ...stair];
  }, [tribuneInnerX, sideSign, stairSteps]);

  const backOuterX = tribuneInnerX + sideSign * TRIBUNE_ROWS * ROW_DEPTH;
  const platformCenterX = tribuneInnerX + (sideSign * TRIBUNE_ROWS * ROW_DEPTH) / 2;
  const platformDepth = TRIBUNE_ROWS * ROW_DEPTH + 0.35;
  const platformWidth = SECTION_WIDTH + 0.45;
  const hasStairs = stairSteps.length > 0;
  const foundationWidth = hasStairs
    ? platformWidth + FOUNDATION_OVERHANG * 2 + STAIR_WIDTH * 2
    : platformWidth + FOUNDATION_OVERHANG * 2;
  const canopyY = canopyCenterY();
  const topRowTop = rowTopY(TRIBUNE_ROWS - 1);

  return (
    <group position={[0, ROAD_TOP_Y, sectionZ]}>
      <mesh
        position={[platformCenterX, -FOUNDATION_THICKNESS / 2 + 0.02, 0]}
        receiveShadow
        castShadow
        material={materials.platform}
        dispose={null}
      >
        <boxGeometry
          args={[platformDepth + FOUNDATION_OVERHANG * 2, FOUNDATION_THICKNESS, foundationWidth]}
        />
      </mesh>

      <mesh
        position={[platformCenterX, ROW_HEIGHT / 2 - 0.02, 0]}
        receiveShadow
        material={materials.platform}
        dispose={null}
      >
        <boxGeometry args={[platformDepth, ROW_HEIGHT, platformWidth]} />
      </mesh>

      {Array.from({ length: TRIBUNE_ROWS }, (_, row) => (
        <mesh
          key={`step-${row}`}
          position={[
            tribuneRowCenterX(tribuneInnerX, sideSign, row),
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

      <InstancedBoxes items={woodParts} material={materials.seat} castShadow={false} />

      <mesh
        position={[backOuterX + sideSign * (FASCIA_THICKNESS / 2), topRowTop + FASCIA_HEIGHT / 2, 0]}
        castShadow
        receiveShadow
        material={materials.structure}
        dispose={null}
      >
        <boxGeometry args={[FASCIA_THICKNESS, FASCIA_HEIGHT, SECTION_WIDTH + 0.2]} />
      </mesh>

      <mesh
        position={[
          backOuterX + sideSign * (FASCIA_THICKNESS + 0.02),
          topRowTop + FASCIA_HEIGHT * 0.65,
          0,
        ]}
        castShadow
      >
        <boxGeometry args={[0.03, 0.12, SECTION_WIDTH - 0.4]} />
        <meshStandardMaterial
          color={palette.accent}
          emissive={palette.accent}
          emissiveIntensity={isNight ? 0.9 : 0.15}
          toneMapped={false}
          roughness={0.5}
          metalness={0.2}
        />
      </mesh>

      <InstancedBoxes
        items={canopyPosts}
        fixedSizeXZ={CANOPY_POST_SIZE}
        material={materials.metal}
      />

      <mesh
        position={[
          tribuneInnerX + (sideSign * (TRIBUNE_ROWS * ROW_DEPTH + 0.35)) / 2,
          canopyY,
          0,
        ]}
        castShadow
        receiveShadow
        material={materials.canopy}
        dispose={null}
      >
        <boxGeometry args={[TRIBUNE_ROWS * ROW_DEPTH + 0.7, CANOPY_THICKNESS, SECTION_WIDTH + 0.8]} />
      </mesh>

      {stairSteps.map((step, i) => (
        <mesh
          key={`stair-${i}`}
          position={step.position}
          castShadow
          receiveShadow
          material={i % 2 === 0 ? materials.stepEven : materials.stepOdd}
          dispose={null}
        >
          <boxGeometry args={[...step.size]} />
        </mesh>
      ))}

      {stairStringer ? (
        <mesh
          position={stairStringer.position}
          castShadow
          receiveShadow
          material={materials.metal}
          dispose={null}
        >
          <boxGeometry args={[...stairStringer.size]} />
        </mesh>
      ) : null}

      <InstancedBoxes items={railParts} material={materials.metal} castShadow={false} />

      <SpectatorCrowd seats={seats} palette={palette} isNight={isNight} paused={paused} />
    </group>
  );
};

/** Открытые трибуны у старт/финиш (визуал; коллайдеры — TrackTribuneColliders) */
export const TrackTribunes = ({
  line,
  roadWidth,
  palette,
  side,
  isNight,
  paused,
}: TTrackTribunesProps) => {
  const sideSign = tribuneSideSign(side);
  const tribuneInnerX = sideSign * (roadWidth / 2 + WALL_OFFSET + TRIBUNE_MARGIN);

  const structureColor = isNight ? tribunePalette.night.structure : tribunePalette.day.structure;
  const stepColor = isNight ? tribunePalette.night.step : tribunePalette.day.step;
  const platformColor = isNight ? tribunePalette.night.platform : tribunePalette.day.platform;
  const canopyColor = isNight ? tribunePalette.night.rail : tribunePalette.day.metal;
  const seatColor = isNight ? tribunePalette.night.seat : tribunePalette.day.seat;
  const metalColor = isNight ? tribunePalette.night.metal : tribunePalette.day.metal;

  const concreteMap = useMemo(() => getSharedConcreteTexture(256), []);
  const woodMap = useMemo(() => getSharedWoodTexture(256), []);
  const metalMap = useMemo(() => getSharedCorrugatedMetalTexture(256), []);

  const materials = useMemo((): TTribuneMaterials => {
    return {
      platform: new MeshStandardMaterial({
        map: concreteMap,
        color: platformColor,
        roughness: 0.92,
        metalness: 0.02,
      }),
      stepEven: new MeshStandardMaterial({
        map: concreteMap,
        color: stepColor,
        roughness: 0.9,
        metalness: 0.02,
        emissive: isNight ? startLightPalette.floodLight : '#000000',
        emissiveIntensity: isNight ? 0.08 : 0,
      }),
      stepOdd: new MeshStandardMaterial({
        map: concreteMap,
        color: structureColor,
        roughness: 0.9,
        metalness: 0.02,
        emissive: isNight ? startLightPalette.floodLight : '#000000',
        emissiveIntensity: isNight ? 0.06 : 0,
      }),
      canopy: new MeshStandardMaterial({
        map: metalMap,
        color: canopyColor,
        roughness: 0.35,
        metalness: 0.82,
      }),
      seat: new MeshStandardMaterial({
        map: woodMap,
        color: seatColor,
        roughness: 0.78,
        metalness: 0,
        emissive: isNight ? startLightPalette.floodLight : '#000000',
        emissiveIntensity: isNight ? 0.12 : 0,
      }),
      metal: new MeshStandardMaterial({
        color: metalColor,
        roughness: 0.38,
        metalness: 0.75,
      }),
      structure: new MeshStandardMaterial({
        map: concreteMap,
        color: structureColor,
        roughness: 0.88,
        metalness: 0.04,
        emissive: isNight ? startLightPalette.floodLight : '#000000',
        emissiveIntensity: isNight ? 0.06 : 0,
      }),
    };
  }, [
    concreteMap,
    woodMap,
    metalMap,
    platformColor,
    stepColor,
    structureColor,
    canopyColor,
    seatColor,
    metalColor,
    isNight,
  ]);

  // Освобождает материалы (текстуры — singleton, не dispose).
  useEffect(
    () => () => {
      materials.platform.dispose();
      materials.stepEven.dispose();
      materials.stepOdd.dispose();
      materials.canopy.dispose();
      materials.seat.dispose();
      materials.metal.dispose();
      materials.structure.dispose();
    },
    [materials],
  );

  return (
    <group position={[line.position[0], 0, line.position[2]]} rotation={[0, line.rotationY, 0]}>
      {SECTION_Z_OFFSETS.map((sectionZ, sectionIndex) => (
        <TribuneSection
          key={`tribune-${sectionZ}`}
          sectionZ={sectionZ}
          sectionIndex={sectionIndex}
          tribuneInnerX={tribuneInnerX}
          sideSign={sideSign}
          palette={palette}
          isNight={isNight}
          paused={paused}
          materials={materials}
        />
      ))}
      {SECTION_Z_OFFSETS.map((sectionZ) => (
        <TribuneRowAccents
          key={`tribune-accent-${sectionZ}`}
          tribuneInnerX={tribuneInnerX}
          sideSign={sideSign}
          sectionZ={sectionZ}
          accent={palette.accent}
          isOn={isNight}
        />
      ))}
      <TribuneEdgeFloods tribuneInnerX={tribuneInnerX} sideSign={sideSign} isOn={isNight} />
    </group>
  );
};

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTranslation } from 'react-i18next';
import type { RapierRigidBody } from '@react-three/rapier';
import { DoubleSide, type CanvasTexture } from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {
  isTrackLightingOn,
  placeBillboards,
  type TPlacedBillboard,
  type TTrackConfig,
} from '@/entities/track';
import { billboardPalette, type TAppLocale } from '@/shared/config';
import {
  BILLBOARD_ACTIVE_WASH,
  BILLBOARD_FACE_WASH,
  BILLBOARD_FLOOD,
  BILLBOARD_FRAME_DEPTH,
  BILLBOARD_FRAME_THICKNESS,
  BILLBOARD_FRAME_TOP_Y,
  BILLBOARD_NIGHT_FACE,
  BILLBOARD_PANEL_CENTER_Y,
  BILLBOARD_PANEL_DEPTH,
  BILLBOARD_PANEL_FORWARD_X,
  BILLBOARD_PANEL_HEIGHT,
  BILLBOARD_PANEL_WIDTH,
  BILLBOARD_POST,
  BILLBOARD_POST_HALF_SPAN,
  BILLBOARD_POST_HEIGHT,
  faceGlowIntensity,
} from '@/widgets/race-canvas/lib/billboard';
import { createBillboardTexture } from '@/widgets/race-canvas/lib/billboard-ads';

let rectAreaLightsReady = false;

/** Один раз инициализирует шейдеры RectAreaLight */
const ensureRectAreaLights = () => {
  if (rectAreaLightsReady) {
    return;
  }
  RectAreaLightUniformsLib.init();
  rectAreaLightsReady = true;
};

type TTrackBillboardsProps = {
  /** Конфиг трассы */
  config: TTrackConfig;
  /** Ref машины — выбираем ближайшие щиты для RectAreaLight */
  bodyRef?: RefObject<RapierRigidBody | null>;
};

type TBillboardProps = {
  /** Размещенный щит */
  billboard: TPlacedBillboard;
  /** Ночная трасса — gooseneck-подсветка включена */
  isNight: boolean;
  /** Монтировать RectAreaLight (distance-LOD) */
  hasWash: boolean;
  /** Текстура макета */
  texture: CanvasTexture;
};

type TFloodLightProps = {
  /** Смещение по ширине щита (локальный Z) */
  localZ: number;
  /** Горят ли лампы */
  isOn: boolean;
};

/** Визуал gooseneck-корпуса (свет лица — RectAreaLight на щите при hasWash) */
const FloodLight = ({ localZ, isOn }: TFloodLightProps) => {
  const {
    mount,
    riserHeight,
    armLength,
    armPitch,
    neckLength,
    neckPitch,
    armRadius,
    housing,
    bulbRadius,
  } = BILLBOARD_FLOOD;
  /** Верх стойки = низ вылета */
  const elbowY = mount.height + riserHeight;

  return (
    <group position={[BILLBOARD_PANEL_FORWARD_X, BILLBOARD_FRAME_TOP_Y, localZ]}>
      <mesh position={[0, mount.height / 2, 0]}>
        <boxGeometry args={[mount.depth, mount.height, mount.width]} />
        <meshStandardMaterial color={billboardPalette.floodArm} metalness={0.72} roughness={0.38} />
      </mesh>

      <mesh position={[0, mount.height + riserHeight / 2, 0]}>
        <cylinderGeometry args={[armRadius, armRadius * 1.05, riserHeight, 8]} />
        <meshStandardMaterial color={billboardPalette.floodArm} metalness={0.72} roughness={0.38} />
      </mesh>

      <mesh position={[0, elbowY, 0]}>
        <sphereGeometry args={[armRadius * 1.55, 10, 8]} />
        <meshStandardMaterial color={billboardPalette.floodArm} metalness={0.7} roughness={0.4} />
      </mesh>

      <group position={[0, elbowY, 0]} rotation={[0, 0, -armPitch]}>
        <mesh position={[armLength / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[armRadius, armRadius * 0.95, armLength, 8]} />
          <meshStandardMaterial
            color={billboardPalette.floodArm}
            metalness={0.72}
            roughness={0.38}
          />
        </mesh>

        <group position={[armLength, 0, 0]} rotation={[0, 0, -neckPitch]}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[armRadius * 1.35, 10, 8]} />
            <meshStandardMaterial
              color={billboardPalette.floodArm}
              metalness={0.7}
              roughness={0.4}
            />
          </mesh>
          <mesh position={[neckLength / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <cylinderGeometry args={[armRadius * 0.95, armRadius * 0.85, neckLength, 8]} />
            <meshStandardMaterial
              color={billboardPalette.floodArm}
              metalness={0.72}
              roughness={0.38}
            />
          </mesh>

          <group position={[neckLength, 0, 0]}>
            <mesh>
              <boxGeometry args={[housing.depth, housing.height, housing.width]} />
              <meshStandardMaterial
                color={billboardPalette.floodHousing}
                metalness={0.55}
                roughness={0.45}
              />
            </mesh>
            <mesh position={[housing.depth * 0.15, -housing.height * 0.35, 0]}>
              <sphereGeometry args={[bulbRadius, 10, 8]} />
              <meshStandardMaterial
                color={isOn ? billboardPalette.floodBulbOn : billboardPalette.floodBulbOff}
                emissive={isOn ? billboardPalette.floodBulbOn : '#000000'}
                emissiveIntensity={isOn ? BILLBOARD_NIGHT_FACE.bulbEmissive : 0}
                toneMapped={false}
                metalness={0.1}
                roughness={0.35}
              />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
};

/** Ровная заливка лица щита — без конусных кругов SpotLight */
const BillboardFaceWash = () => {
  // Подключает uniforms RectAreaLight один раз на приложение.
  useLayoutEffect(() => {
    ensureRectAreaLights();
  }, []);

  const faceX = BILLBOARD_PANEL_FORWARD_X + BILLBOARD_PANEL_DEPTH / 2;

  return (
    <rectAreaLight
      position={[faceX + BILLBOARD_FACE_WASH.standoff, BILLBOARD_PANEL_CENTER_Y, 0]}
      /** −Z источника → −X мира: свет смотрит на лицо щита */
      rotation={[0, Math.PI / 2, 0]}
      width={BILLBOARD_FACE_WASH.width}
      height={BILLBOARD_FACE_WASH.height}
      intensity={BILLBOARD_FACE_WASH.intensity}
      color={billboardPalette.floodLight}
    />
  );
};

/** Один придорожный щит: столбы, бумажный короб, gooseneck-подсветка */
const Billboard = ({ billboard, isNight, hasWash, texture }: TBillboardProps) => {
  const postCenterY = BILLBOARD_POST_HEIGHT / 2;
  const frameOuterWidth = BILLBOARD_PANEL_WIDTH + BILLBOARD_FRAME_THICKNESS * 2;
  const frameOuterHeight = BILLBOARD_PANEL_HEIGHT + BILLBOARD_FRAME_THICKNESS * 2;
  const frameCenterX = BILLBOARD_PANEL_FORWARD_X;
  const useFaceFallback = isNight && !hasWash;
  /** Яркость нормирована по макету: светлый «for-rent» не выбеливается, темные макеты не чернеют */
  const avgLuminance = texture.userData.avgLuminance as number | undefined;
  const faceGlow = faceGlowIntensity(avgLuminance ?? BILLBOARD_NIGHT_FACE.faceGlowTargetLuma);

  return (
    <group position={[billboard.x, 0, billboard.z]} rotation={[0, billboard.rotationY, 0]}>
      {/* Левый столб */}
      <mesh position={[0, postCenterY, -BILLBOARD_POST_HALF_SPAN]} castShadow receiveShadow>
        <boxGeometry args={[BILLBOARD_POST.width, BILLBOARD_POST_HEIGHT, BILLBOARD_POST.depth]} />
        <meshStandardMaterial color={billboardPalette.pole} metalness={0.78} roughness={0.35} />
      </mesh>

      {/* Правый столб */}
      <mesh position={[0, postCenterY, BILLBOARD_POST_HALF_SPAN]} castShadow receiveShadow>
        <boxGeometry args={[BILLBOARD_POST.width, BILLBOARD_POST_HEIGHT, BILLBOARD_POST.depth]} />
        <meshStandardMaterial color={billboardPalette.pole} metalness={0.78} roughness={0.35} />
      </mesh>

      {/* Верхняя балка рамы */}
      <mesh
        position={[
          frameCenterX,
          BILLBOARD_PANEL_CENTER_Y + BILLBOARD_PANEL_HEIGHT / 2 + BILLBOARD_FRAME_THICKNESS / 2,
          0,
        ]}
        castShadow
      >
        <boxGeometry args={[BILLBOARD_FRAME_DEPTH, BILLBOARD_FRAME_THICKNESS, frameOuterWidth]} />
        <meshStandardMaterial color={billboardPalette.frame} metalness={0.25} roughness={0.7} />
      </mesh>

      {/* Нижняя балка рамы */}
      <mesh
        position={[
          frameCenterX,
          BILLBOARD_PANEL_CENTER_Y - BILLBOARD_PANEL_HEIGHT / 2 - BILLBOARD_FRAME_THICKNESS / 2,
          0,
        ]}
        castShadow
      >
        <boxGeometry args={[BILLBOARD_FRAME_DEPTH, BILLBOARD_FRAME_THICKNESS, frameOuterWidth]} />
        <meshStandardMaterial color={billboardPalette.frame} metalness={0.25} roughness={0.7} />
      </mesh>

      {/* Боковые стойки рамы */}
      <mesh
        position={[
          frameCenterX,
          BILLBOARD_PANEL_CENTER_Y,
          -BILLBOARD_PANEL_WIDTH / 2 - BILLBOARD_FRAME_THICKNESS / 2,
        ]}
        castShadow
      >
        <boxGeometry args={[BILLBOARD_FRAME_DEPTH, frameOuterHeight, BILLBOARD_FRAME_THICKNESS]} />
        <meshStandardMaterial color={billboardPalette.frame} metalness={0.25} roughness={0.7} />
      </mesh>
      <mesh
        position={[
          frameCenterX,
          BILLBOARD_PANEL_CENTER_Y,
          BILLBOARD_PANEL_WIDTH / 2 + BILLBOARD_FRAME_THICKNESS / 2,
        ]}
        castShadow
      >
        <boxGeometry args={[BILLBOARD_FRAME_DEPTH, frameOuterHeight, BILLBOARD_FRAME_THICKNESS]} />
        <meshStandardMaterial color={billboardPalette.frame} metalness={0.25} roughness={0.7} />
      </mesh>

      {/* Короб панели (тыл / толщина) */}
      <mesh
        position={[BILLBOARD_PANEL_FORWARD_X, BILLBOARD_PANEL_CENTER_Y, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[BILLBOARD_PANEL_DEPTH, BILLBOARD_PANEL_HEIGHT, BILLBOARD_PANEL_WIDTH]}
        />
        <meshStandardMaterial color={billboardPalette.panelBack} metalness={0.05} roughness={0.9} />
      </mesh>

      {/* Бумажное / виниловое лицо: снаружи RectAreaLight; дальние — слабый emissive */}
      <mesh
        position={[
          BILLBOARD_PANEL_FORWARD_X + BILLBOARD_PANEL_DEPTH / 2 + 0.005,
          BILLBOARD_PANEL_CENTER_Y,
          0,
        ]}
        rotation={[0, Math.PI / 2, 0]}
        castShadow
        receiveShadow
      >
        <planeGeometry args={[BILLBOARD_PANEL_WIDTH, BILLBOARD_PANEL_HEIGHT]} />
        <meshStandardMaterial
          map={texture}
          color="#e8e4dc"
          emissive={useFaceFallback ? '#ffffff' : '#000000'}
          emissiveMap={useFaceFallback ? texture : null}
          emissiveIntensity={useFaceFallback ? faceGlow : 0}
          metalness={0}
          roughness={0.9}
          side={DoubleSide}
        />
      </mesh>

      <FloodLight localZ={-BILLBOARD_FLOOD.zSpan} isOn={isNight} />
      <FloodLight localZ={BILLBOARD_FLOOD.zSpan} isOn={isNight} />
      {hasWash ? <BillboardFaceWash /> : null}
    </group>
  );
};

/** Расстояние от (x,z) до щита */
const billboardDistance = (billboard: TPlacedBillboard, x: number, z: number): number =>
  Math.hypot(billboard.x - x, billboard.z - z);

/** K ближайших щитов с hysteresis: прежние wash остаются, пока не дальше K-го + margin. Возвращает отсортированные индексы (ближайший первым). */
const selectActiveWashIndices = (
  billboards: TPlacedBillboard[],
  x: number,
  z: number,
  k: number,
  prev: readonly number[],
  hysteresis: number,
): number[] => {
  if (billboards.length === 0 || k <= 0) {
    return [];
  }
  const ranked = billboards.map((billboard, index) => ({
    index,
    d: billboardDistance(billboard, x, z),
  }));
  ranked.sort((a, b) => a.d - b.d);
  const limit = Math.min(k, ranked.length);
  const kthDist = ranked[limit - 1]?.d ?? 0;
  const cutoff = kthDist + hysteresis;

  const next = new Set<number>();
  for (const index of prev) {
    const billboard = billboards[index];
    if (!billboard || next.size >= limit) {
      continue;
    }
    if (billboardDistance(billboard, x, z) <= cutoff) {
      next.add(index);
    }
  }
  for (const { index } of ranked) {
    if (next.size >= limit) {
      break;
    }
    next.add(index);
  }

  return [...next].sort((a, b) => {
    const da = billboardDistance(billboards[a]!, x, z);
    const db = billboardDistance(billboards[b]!, x, z);
    return da - db;
  });
};

/** Стабильный ключ набора индексов для сравнения */
const indicesKey = (indices: readonly number[]): string =>
  [...indices].sort((a, b) => a - b).join(',');

/** Визуал рекламных щитов вне Physics. Коллайдеры — в TrackBillboardColliders. Ночью RectAreaLight — только у K ближайших к машине. */
export const TrackBillboards = ({ config, bodyRef }: TTrackBillboardsProps) => {
  const { i18n } = useTranslation();
  const locale: TAppLocale = i18n.language === 'en' ? 'en' : 'ru';
  const billboards = useMemo(() => placeBillboards({ config }), [config]);
  const isNight = isTrackLightingOn(config);

  const initialActive = useMemo(
    () => billboards.slice(0, BILLBOARD_ACTIVE_WASH.count).map((_, i) => i),
    [billboards],
  );
  const [activeWashIndices, setActiveWashIndices] = useState<number[]>(initialActive);
  const [prevInitialActive, setPrevInitialActive] = useState(initialActive);
  const activeRef = useRef(initialActive);
  const pendingActiveKeyRef = useRef<string | null>(null);

  // Обновляет active wash set; setState — после кадра.
  useFrame(() => {
    if (!isNight || !bodyRef?.current || billboards.length === 0) {
      return;
    }
    const { x, z } = bodyRef.current.translation();
    const nextActive = selectActiveWashIndices(
      billboards,
      x,
      z,
      BILLBOARD_ACTIVE_WASH.count,
      activeRef.current,
      BILLBOARD_ACTIVE_WASH.switchHysteresis,
    );
    const nextKey = indicesKey(nextActive);
    const prevKey = indicesKey(activeRef.current);
    if (nextKey !== prevKey && pendingActiveKeyRef.current !== nextKey) {
      pendingActiveKeyRef.current = nextKey;
      activeRef.current = nextActive;
      queueMicrotask(() => {
        setActiveWashIndices(nextActive);
        pendingActiveKeyRef.current = null;
      });
    }
  });

  const textures = useMemo(() => {
    const map = new Map<string, CanvasTexture>();
    for (const billboard of billboards) {
      if (!map.has(billboard.adId)) {
        map.set(billboard.adId, createBillboardTexture(billboard.adId, locale));
      }
    }
    return map;
  }, [billboards, locale]);

  // Освобождает GPU-текстуры при смене трассы / языка / размонтировании.
  useEffect(() => {
    return () => {
      for (const texture of textures.values()) {
        texture.dispose();
      }
    };
  }, [textures]);

  // Синхронизирует initial active при смене списка щитов: state корректируется на render (паттерн React)
  if (prevInitialActive !== initialActive) {
    setPrevInitialActive(initialActive);
    setActiveWashIndices(initialActive);
  }

  useEffect(() => {
    activeRef.current = initialActive;
  }, [initialActive]);

  const activeWashSet = useMemo(() => new Set(activeWashIndices), [activeWashIndices]);

  if (billboards.length === 0) {
    return null;
  }

  return (
    <group>
      {billboards.map((billboard, index) => {
        const texture = textures.get(billboard.adId);
        if (!texture) {
          return null;
        }
        return (
          <Billboard
            key={`billboard-${index}-${billboard.adId}-${locale}`}
            billboard={billboard}
            isNight={isNight}
            hasWash={isNight && activeWashSet.has(index)}
            texture={texture}
          />
        );
      })}
    </group>
  );
};

import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DoubleSide, type CanvasTexture } from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {
  placeBillboards,
  type TPlacedBillboard,
  type TTrackConfig,
} from '@/entities/track';
import { billboardPalette, type TAppLocale } from '@/shared/config';
import {
  BILLBOARD_FACE_WASH,
  BILLBOARD_FLOOD,
  BILLBOARD_FRAME_DEPTH,
  BILLBOARD_FRAME_THICKNESS,
  BILLBOARD_FRAME_TOP_Y,
  BILLBOARD_PANEL_CENTER_Y,
  BILLBOARD_PANEL_DEPTH,
  BILLBOARD_PANEL_FORWARD_X,
  BILLBOARD_PANEL_HEIGHT,
  BILLBOARD_PANEL_WIDTH,
  BILLBOARD_POST,
  BILLBOARD_POST_HALF_SPAN,
  BILLBOARD_POST_HEIGHT,
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
};

type TBillboardProps = {
  /** Размещённый щит */
  billboard: TPlacedBillboard;
  /** Ночная трасса — gooseneck-подсветка включена */
  isNight: boolean;
  /** Текстура макета */
  texture: CanvasTexture;
};

type TFloodLightProps = {
  /** Смещение по ширине щита (локальный Z) */
  localZ: number;
  /** Горят ли лампы */
  isOn: boolean;
};

/** Визуал gooseneck-корпуса (свет лица — RectAreaLight на щите; без cast — тонкие трубки) */
const FloodLight = ({ localZ, isOn }: TFloodLightProps) => {
  const { mount, riserHeight, armLength, armPitch, neckLength, neckPitch, armRadius, housing, bulbRadius } =
    BILLBOARD_FLOOD;
  /** Верх стойки = низ вылета */
  const elbowY = mount.height + riserHeight;

  return (
    <group position={[BILLBOARD_PANEL_FORWARD_X, BILLBOARD_FRAME_TOP_Y, localZ]}>
      <mesh position={[0, mount.height / 2, 0]}>
        <boxGeometry args={[mount.depth, mount.height, mount.width]} />
        <meshStandardMaterial
          color={billboardPalette.floodArm}
          metalness={0.72}
          roughness={0.38}
        />
      </mesh>

      <mesh position={[0, mount.height + riserHeight / 2, 0]}>
        <cylinderGeometry args={[armRadius, armRadius * 1.05, riserHeight, 8]} />
        <meshStandardMaterial
          color={billboardPalette.floodArm}
          metalness={0.72}
          roughness={0.38}
        />
      </mesh>

      <mesh position={[0, elbowY, 0]}>
        <sphereGeometry args={[armRadius * 1.55, 10, 8]} />
        <meshStandardMaterial
          color={billboardPalette.floodArm}
          metalness={0.7}
          roughness={0.4}
        />
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
                emissiveIntensity={isOn ? 0.45 : 0}
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
const Billboard = ({ billboard, isNight, texture }: TBillboardProps) => {
  const postCenterY = BILLBOARD_POST_HEIGHT / 2;
  const frameOuterWidth = BILLBOARD_PANEL_WIDTH + BILLBOARD_FRAME_THICKNESS * 2;
  const frameOuterHeight = BILLBOARD_PANEL_HEIGHT + BILLBOARD_FRAME_THICKNESS * 2;
  const frameCenterX = BILLBOARD_PANEL_FORWARD_X;

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
        <meshStandardMaterial
          color={billboardPalette.panelBack}
          metalness={0.05}
          roughness={0.9}
        />
      </mesh>

      {/* Бумажное / виниловое лицо (без emissive — только внешний свет) */}
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
          metalness={0}
          roughness={0.9}
          side={DoubleSide}
        />
      </mesh>

      {/* Две gooseneck-лампы (визуал) + ровная area-заливка лица */}
      <FloodLight localZ={-BILLBOARD_FLOOD.zSpan} isOn={isNight} />
      <FloodLight localZ={BILLBOARD_FLOOD.zSpan} isOn={isNight} />
      {isNight ? <BillboardFaceWash /> : null}
    </group>
  );
};

/**
 * Визуал рекламных щитов вне Physics.
 * Коллайдеры — в TrackBillboardColliders.
 */
export const TrackBillboards = ({ config }: TTrackBillboardsProps) => {
  const { i18n } = useTranslation();
  const locale: TAppLocale = i18n.language === 'en' ? 'en' : 'ru';
  const billboards = useMemo(() => placeBillboards({ config }), [config]);
  const isNight = config.timeOfDay === 'night';

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
            texture={texture}
          />
        );
      })}
    </group>
  );
};

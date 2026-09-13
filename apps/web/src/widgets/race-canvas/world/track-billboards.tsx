import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DoubleSide, type CanvasTexture, type Object3D, type SpotLight } from 'three';
import {
  placeBillboards,
  type TPlacedBillboard,
  type TTrackConfig,
} from '@/entities/track';
import { billboardPalette, type TAppLocale } from '@/shared/config';
import {
  BILLBOARD_FLOOD,
  BILLBOARD_FLOOD_FILL,
  BILLBOARD_FLOOD_SPOT,
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

/** Одна gooseneck-лампа: крепление → стойка → вылет → шея → корпус (иерархия без разрывов) */
const FloodLight = ({ localZ, isOn }: TFloodLightProps) => {
  const spotRef = useRef<SpotLight>(null);
  const targetRef = useRef<Object3D>(null);

  const { mount, riserHeight, armLength, armPitch, neckLength, neckPitch, armRadius, housing, bulbRadius } =
    BILLBOARD_FLOOD;
  const faceX = BILLBOARD_PANEL_FORWARD_X + BILLBOARD_PANEL_DEPTH / 2 + 0.02;
  /** Верх стойки = низ вылета */
  const elbowY = mount.height + riserHeight;

  // Оба спота целятся в центр панели (target в пространстве щита, не лампы).
  useLayoutEffect(() => {
    const spot = spotRef.current;
    const target = targetRef.current;
    if (!spot || !target) {
      return;
    }
    spot.target = target;
    spot.target.updateMatrixWorld();
  }, []);

  return (
    <group position={[BILLBOARD_PANEL_FORWARD_X, BILLBOARD_FRAME_TOP_Y, localZ]}>
      {/* Плита крепления, сидит на верхней раме */}
      <mesh position={[0, mount.height / 2, 0]} castShadow>
        <boxGeometry args={[mount.depth, mount.height, mount.width]} />
        <meshStandardMaterial
          color={billboardPalette.floodArm}
          metalness={0.72}
          roughness={0.38}
        />
      </mesh>

      {/* Вертикальная стойка от плиты к локтю */}
      <mesh position={[0, mount.height + riserHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[armRadius, armRadius * 1.05, riserHeight, 8]} />
        <meshStandardMaterial
          color={billboardPalette.floodArm}
          metalness={0.72}
          roughness={0.38}
        />
      </mesh>

      {/* Шарнир / локоть на верху стойки */}
      <mesh position={[0, elbowY, 0]} castShadow>
        <sphereGeometry args={[armRadius * 1.55, 10, 8]} />
        <meshStandardMaterial
          color={billboardPalette.floodArm}
          metalness={0.7}
          roughness={0.4}
        />
      </mesh>

      {/* Вылет вперёд и вниз — начинается в локте */}
      <group position={[0, elbowY, 0]} rotation={[0, 0, -armPitch]}>
        <mesh position={[armLength / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <cylinderGeometry args={[armRadius, armRadius * 0.95, armLength, 8]} />
          <meshStandardMaterial
            color={billboardPalette.floodArm}
            metalness={0.72}
            roughness={0.38}
          />
        </mesh>

        {/* Шейка к корпусу */}
        <group position={[armLength, 0, 0]} rotation={[0, 0, -neckPitch]}>
          <mesh position={[0, 0, 0]} castShadow>
            <sphereGeometry args={[armRadius * 1.35, 10, 8]} />
            <meshStandardMaterial
              color={billboardPalette.floodArm}
              metalness={0.7}
              roughness={0.4}
            />
          </mesh>
          <mesh position={[neckLength / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
            <cylinderGeometry args={[armRadius * 0.95, armRadius * 0.85, neckLength, 8]} />
            <meshStandardMaterial
              color={billboardPalette.floodArm}
              metalness={0.72}
              roughness={0.38}
            />
          </mesh>

          {/* Корпус + колба на конце шеи */}
          <group position={[neckLength, 0, 0]}>
            <mesh castShadow>
              <boxGeometry args={[housing.depth, housing.height, housing.width]} />
              <meshStandardMaterial
                color={billboardPalette.floodHousing}
                metalness={0.55}
                roughness={0.45}
              />
            </mesh>
            {/* Лицевая линза смотрит на щит (−локальный X шеи ≈ вниз/назад к панели) */}
            <mesh position={[housing.depth * 0.15, -housing.height * 0.35, 0]}>
              <sphereGeometry args={[bulbRadius, 10, 8]} />
              <meshStandardMaterial
                color={isOn ? billboardPalette.floodBulbOn : billboardPalette.floodBulbOff}
                emissive={isOn ? billboardPalette.floodBulbOn : '#000000'}
                emissiveIntensity={isOn ? 0.85 : 0}
                metalness={0.1}
                roughness={0.35}
              />
            </mesh>

            {isOn ? (
              <>
                <spotLight
                  ref={spotRef}
                  position={[0.02, -0.04, 0]}
                  color={billboardPalette.floodLight}
                  intensity={BILLBOARD_FLOOD_SPOT.intensity}
                  distance={BILLBOARD_FLOOD_SPOT.distance}
                  angle={BILLBOARD_FLOOD_SPOT.angle}
                  penumbra={BILLBOARD_FLOOD_SPOT.penumbra}
                  decay={BILLBOARD_FLOOD_SPOT.decay}
                  castShadow={false}
                />
                <pointLight
                  position={[0.04, -0.08, 0]}
                  color={billboardPalette.floodLight}
                  intensity={BILLBOARD_FLOOD_FILL.intensity}
                  distance={BILLBOARD_FLOOD_FILL.distance}
                  decay={BILLBOARD_FLOOD_FILL.decay}
                />
              </>
            ) : null}
          </group>
        </group>
      </group>

      {/* Цель спота — центр лица щита (в координатах корня лампы) */}
      {isOn ? (
        <object3D
          ref={targetRef}
          position={[
            faceX - BILLBOARD_PANEL_FORWARD_X,
            BILLBOARD_PANEL_CENTER_Y - BILLBOARD_FRAME_TOP_Y - BILLBOARD_PANEL_HEIGHT * 0.05,
            -localZ,
          ]}
        />
      ) : null}
    </group>
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
          color="#ffffff"
          metalness={0}
          roughness={0.92}
          side={DoubleSide}
        />
      </mesh>

      {/* Две лампы сверху */}
      <FloodLight localZ={-BILLBOARD_FLOOD.zSpan} isOn={isNight} />
      <FloodLight localZ={BILLBOARD_FLOOD.zSpan} isOn={isNight} />
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

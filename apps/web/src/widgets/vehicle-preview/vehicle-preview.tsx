import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import type { TVehicleId } from '@/entities/vehicle';
import { carSkins } from '@/shared/config';
import { cx } from '@/shared/lib';
import {
  preloadVehicleModel,
  type TVehicleDriveVisual,
  VehicleModel,
} from '@/widgets/race-canvas';

/** Пустой drive — стартовое значение ref'а (каждый превью мутирует СВОЮ копию). */
const IDLE_DRIVE: TVehicleDriveVisual = {
  forwardSpeed: 0,
  steer: 0,
  brake: 0,
  kerbRumble: 0,
};

/** Дневной скин — как на coastal; ночной цвет показан легендой на странице */
const PREVIEW_SKIN = carSkins.coastal;

/** Фон превью (ближе к --bg, без прозрачности WebGL) */
const PREVIEW_CLEAR = '#ebe7f2';

/** Скорость лёгкого вращения превью (рад/с) */
const PREVIEW_SPIN = 0.35;

/**
 * Демо-руление превью: передние колёса качаются влево-вправо через продакшн-риг
 * (steer → steerPivot), как в заезде. Без этого превью всегда кормит steer=0, и
 * колёса («steer and spin garage wheels from measured axle») не поворачиваются.
 */
const PREVIEW_STEER_SWING = 0.55;
/** Плавный размах руля (рад/с): полный влево-вправо ≈ 2π / 0.65 ≈ 9.7 с */
const PREVIEW_STEER_SPEED = 0.65;
/** Небольшая продольная скорость (м/с), чтобы колёса медленно вращались */
const PREVIEW_SPIN_SPEED = 1.1;

/**
 * Стартовый ракурс ~¾ + 180° только для превью гаража (на гонку не влияет).
 * Все кузова после normalize смотрят в +Z — крутим одинаково.
 */
const INITIAL_YAW = Math.PI * 0.72 + Math.PI;

/** Точка взгляда камеры — примерно центр кузова после fit */
const LOOK_AT: [number, number, number] = [0, 0.5, 0];

type TPreviewSceneProps = {
  vehicleId: TVehicleId;
};

/** Наводит камеру на центр машины */
const PreviewCameraAim = () => {
  const { camera } = useThree();
  useEffect(() => {
    camera.lookAt(...LOOK_AT);
  }, [camera]);
  return null;
};

/** Сцена: свет уровня дневной трассы + тот же VehicleModel */
const PreviewScene = ({ vehicleId }: TPreviewSceneProps) => {
  const turntableRef = useRef<Group>(null);
  const timeRef = useRef(0);
  // Своя копия на превью: useFrame мутирует .current, общий IDLE_DRIVE нельзя делить между карточками.
  const driveVisualRef = useRef<TVehicleDriveVisual>({ ...IDLE_DRIVE });

  useFrame((_, dt) => {
    if (!turntableRef.current) {
      return;
    }
    timeRef.current += dt;
    turntableRef.current.rotation.y += dt * PREVIEW_SPIN;

    // Демо-руление: front-колёса качаются влево-вправо (steer → steerPivot) и все
    // колёса медленно вращаются (spin от forwardSpeed) — через тот же продакшн-путь,
    // что в заезде. Так «steer and spin garage wheels» виден в самих превью гаража.
    driveVisualRef.current.steer =
      Math.sin(timeRef.current * PREVIEW_STEER_SPEED) * PREVIEW_STEER_SWING;
    driveVisualRef.current.forwardSpeed = PREVIEW_SPIN_SPEED;
  });

  return (
    <>
      <PreviewCameraAim />
      <color attach="background" args={[PREVIEW_CLEAR]} />
      {/* Интенсивности близки к дневному ambient в RaceCanvas */}
      <ambientLight intensity={2.4} />
      <directionalLight position={[4, 8, 3]} intensity={2.8} color="#fff4e0" />
      <directionalLight position={[-3, 3, -4]} intensity={0.9} color="#d0e8ff" />
      <group ref={turntableRef} rotation={[0, INITIAL_YAW, 0]} position={[0, -0.02, 0]}>
        <VehicleModel
          vehicleId={vehicleId}
          carSkin={PREVIEW_SKIN}
          headlightsOn={false}
          driveVisualRef={driveVisualRef}
        />
      </group>
    </>
  );
};

type TVehiclePreviewProps = {
  /** Id кузова из каталога */
  vehicleId: TVehicleId;
  className?: string;
};

/** 3D-превью кузова для карточек гаража (тот же VehicleModel, что в гонке) */
export const VehiclePreview = ({ vehicleId, className }: TVehiclePreviewProps) => {
  useEffect(() => {
    preloadVehicleModel();
  }, []);

  return (
    <div className={cx('relative overflow-hidden', className ?? '')} aria-hidden>
      <Canvas
        className="pointer-events-none h-full w-full touch-none"
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: 'default' }}
        camera={{ position: [3.6, 1.45, 3.2], fov: 30, near: 0.1, far: 40 }}
        onCreated={({ gl }) => {
          gl.setClearColor(PREVIEW_CLEAR);
        }}
      >
        <PreviewScene vehicleId={vehicleId} />
      </Canvas>
    </div>
  );
};

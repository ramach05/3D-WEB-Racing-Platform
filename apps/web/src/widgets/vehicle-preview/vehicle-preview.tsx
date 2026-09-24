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
  const driveVisualRef = useRef<TVehicleDriveVisual>(IDLE_DRIVE);

  useFrame((_, dt) => {
    if (!turntableRef.current) {
      return;
    }
    turntableRef.current.rotation.y += dt * PREVIEW_SPIN;
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

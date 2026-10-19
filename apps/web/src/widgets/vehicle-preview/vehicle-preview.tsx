import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import type { TVehicleId } from '@/entities/vehicle';
import { carSkins } from '@/shared/config';
import { cx } from '@/shared/lib';
import { preloadVehicleModel, type TVehicleDriveVisual, VehicleModel } from '@/widgets/race-canvas';

/** Empty drive — initial ref value (each preview mutates ITS OWN copy). */
const IDLE_DRIVE: TVehicleDriveVisual = {
  forwardSpeed: 0,
  steer: 0,
  brake: 0,
  kerbRumble: 0,
};

/** Day skin — same as coastal; the night color is shown in the page legend */
const PREVIEW_SKIN = carSkins.coastal;

/** Preview background (close to --bg, no WebGL transparency) */
const PREVIEW_CLEAR = '#ebe7f2';

/** Speed of the preview's slow rotation (rad/s) */
const PREVIEW_SPIN = 0.35;

/** Demo steering swing amplitude for the preview: wheels rock via the production rig (steer → steerPivot); without this the preview always feeds steer=0 */
const PREVIEW_STEER_SWING = 0.55;
/** Smooth steering sweep (rad/s): full left-to-right ≈ 2π / 0.65 ≈ 9.7 s */
const PREVIEW_STEER_SPEED = 0.65;
/** Small forward speed (m/s) so the wheels rotate slowly */
const PREVIEW_SPIN_SPEED = 1.1;

/** Starting ~¾ view angle + 180°, garage previews only (doesn't affect the race). All bodies face +Z after normalize — rotate them identically. */
const INITIAL_YAW = Math.PI * 0.72 + Math.PI;

/** Camera look-at point — roughly the body center after fit */
const LOOK_AT: [number, number, number] = [0, 0.5, 0];

type TPreviewSceneProps = {
  vehicleId: TVehicleId;
};

/** Aims the camera at the car center */
const PreviewCameraAim = () => {
  const { camera } = useThree();
  useEffect(() => {
    camera.lookAt(...LOOK_AT);
  }, [camera]);
  return null;
};

/** Scene: day-track level lighting + the same VehicleModel */
const PreviewScene = ({ vehicleId }: TPreviewSceneProps) => {
  const turntableRef = useRef<Group>(null);
  const timeRef = useRef(0);
  // Own copy per preview: useFrame mutates .current, the shared IDLE_DRIVE must not be split between cards.
  const driveVisualRef = useRef<TVehicleDriveVisual>({ ...IDLE_DRIVE });

  useFrame((_, dt) => {
    if (!turntableRef.current) {
      return;
    }
    timeRef.current += dt;
    turntableRef.current.rotation.y += dt * PREVIEW_SPIN;

    // Demo steering: front wheels rock left-right (steer → steerPivot) and all
    // wheels spin slowly (spin from forwardSpeed) — through the same production path
    // as in the race. This makes «steer and spin garage wheels» visible in the garage previews themselves.
    driveVisualRef.current.steer =
      Math.sin(timeRef.current * PREVIEW_STEER_SPEED) * PREVIEW_STEER_SWING;
    driveVisualRef.current.forwardSpeed = PREVIEW_SPIN_SPEED;
  });

  return (
    <>
      <PreviewCameraAim />
      <color attach="background" args={[PREVIEW_CLEAR]} />
      {/* Intensities are close to the daytime ambient in RaceCanvas */}
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
  /** Body id from the catalog */
  vehicleId: TVehicleId;
  className?: string;
};

/** 3D body preview for garage cards (same VehicleModel as in the race) */
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

import { type RefObject, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, Stars, Stats } from '@react-three/drei';
import { Physics, type RapierRigidBody } from '@react-three/rapier';
import type { TrackConfig } from '@/entities/track';
import { ChaseCamera } from './chase-camera';
import { TrackWorld } from './track-world';
import { Vehicle } from './vehicle';

type RaceSceneProps = {
  config: TrackConfig;
  paused: boolean;
  resetNonce: number;
  onFinished: () => void;
};

type CelestialBodyProps = {
  config: TrackConfig;
};

/** Солнце днём или луна ночью */
const CelestialBody = ({ config }: CelestialBodyProps) => {
  const isNight = config.timeOfDay === 'night';
  const sunPos: [number, number, number] = [55, 42, 25];
  const moonPos: [number, number, number] = [-40, 38, -30];

  if (isNight) {
    return (
      <>
        <mesh position={moonPos}>
          <sphereGeometry args={[3.2, 16, 16]} />
          <meshStandardMaterial color="#e8e4d8" emissive="#c8c4b8" emissiveIntensity={0.6} />
        </mesh>
        <pointLight position={moonPos} intensity={0.35} color="#b8c8ff" distance={200} />
      </>
    );
  }

  return (
    <>
      <mesh position={sunPos}>
        <sphereGeometry args={[4.5, 16, 16]} />
        <meshStandardMaterial color="#ffe066" emissive="#ffcc00" emissiveIntensity={1.1} />
      </mesh>
      <pointLight position={sunPos} intensity={0.5} color="#fff4cc" distance={250} />
    </>
  );
};

/** Свет, физика, трасса и машина */
const RaceSceneInner = ({
  config,
  paused,
  resetNonce,
  onFinished,
  bodyRef,
}: RaceSceneProps & { bodyRef: RefObject<RapierRigidBody | null> }) => {
  const isNight = config.timeOfDay === 'night';

  return (
    <>
      <color attach="background" args={[config.palette.sky]} />
      <fog attach="fog" args={[config.palette.fog, 80, 220]} />
      <hemisphereLight args={[config.palette.sky, config.palette.ground, isNight ? 0.35 : 0.75]} />
      <directionalLight
        position={[40, 60, 20]}
        intensity={isNight ? 0.55 : 1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <CelestialBody config={config} />
      {isNight ? (
        <>
          <Stars radius={120} depth={40} count={2500} factor={3} saturation={0} fade speed={0.4} />
          <pointLight
            position={[0, 12, 0]}
            intensity={1.2}
            color={config.palette.accent}
            distance={80}
          />
        </>
      ) : (
        <Sky sunPosition={[55, 42, 25]} />
      )}
      <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60} paused={paused}>
        <TrackWorld config={config} onFinished={onFinished} />
        <Vehicle
          spawnPosition={config.spawnPosition}
          spawnRotationY={config.spawnRotationY}
          resetNonce={resetNonce}
          bodyRef={bodyRef}
          carSkin={config.carSkin}
          headlightsOn={isNight}
        />
      </Physics>
      <ChaseCamera target={bodyRef} />
      {import.meta.env.DEV ? <Stats className="sega-stats-panel" /> : null}
    </>
  );
};

/** Canvas гонки: отдельно от HUD, чтобы React не убивал FPS */
export const RaceCanvas = ({ config, paused, resetNonce, onFinished }: RaceSceneProps) => {
  const bodyRef = useRef<RapierRigidBody>(null);

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ fov: 60, near: 0.1, far: 500, position: [0, 8, 16] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <RaceSceneInner
        config={config}
        paused={paused}
        resetNonce={resetNonce}
        onFinished={onFinished}
        bodyRef={bodyRef}
      />
    </Canvas>
  );
};

import { type RefObject, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, Stars, Stats } from '@react-three/drei';
import { PCFSoftShadowMap } from 'three';
import { Physics, type RapierRigidBody } from '@react-three/rapier';
import type { TrackConfig } from '@/entities/track';
import { ChaseCamera } from './chase-camera';
import { CheckpointDetector } from './checkpoint-detector';
import { TrackWorld } from './track-world';
import { TrackStartFinishLine } from './track-start-finish-line';
import { TrackTribunes } from './track-tribunes';
import { Vehicle } from './vehicle';
import { HorizonSun } from './horizon-sun';
import { HorizonMoon } from './horizon-moon';

type RaceSceneProps = {
  config: TrackConfig;
  paused: boolean;
  resetNonce: number;
  onFinished: () => void;
};

type CelestialBodyProps = {
  config: TrackConfig;
};

const SUN_HORIZON_POSITION: [number, number, number] = [90, 24, -260];
const MOON_HORIZON_POSITION: [number, number, number] = [-240, 21, 50];
const SUN_LIGHT_POSITION: [number, number, number] = [40, 60, 20];
const MOON_LIGHT_POSITION: [number, number, number] = [-30, 50, -25];
const SKY_SUN_POSITION: [number, number, number] = [55, 42, 25];

/** Солнце днём или луна ночью на уровне горизонта */
const CelestialBody = ({ config }: CelestialBodyProps) => {
  const isNight = config.timeOfDay === 'night';

  if (isNight) {
    return <HorizonMoon position={MOON_HORIZON_POSITION} />;
  }

  return <HorizonSun position={SUN_HORIZON_POSITION} />;
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
        position={isNight ? MOON_LIGHT_POSITION : SUN_LIGHT_POSITION}
        intensity={isNight ? 0.55 : 1.2}
        castShadow={!isNight}
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
        <Sky sunPosition={SKY_SUN_POSITION} />
      )}
      <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60} paused={paused}>
        <TrackWorld config={config} />
        <Vehicle
          spawnPosition={config.spawnPosition}
          spawnRotationY={config.spawnRotationY}
          resetNonce={resetNonce}
          bodyRef={bodyRef}
          carSkin={config.carSkin}
          headlightsOn={isNight}
        />
      </Physics>
      <TrackStartFinishLine
        line={config.startFinishLine}
        roadWidth={config.roadWidth}
        palette={config.palette}
      />
      <TrackTribunes
        line={config.startFinishLine}
        roadWidth={config.roadWidth}
        palette={config.palette}
        side={config.startTribuneSide}
        isNight={isNight}
        paused={paused}
      />
      <CheckpointDetector
        config={config}
        bodyRef={bodyRef}
        resetNonce={resetNonce}
        onFinished={onFinished}
      />
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
      onCreated={({ gl }) => {
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = PCFSoftShadowMap;
      }}
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

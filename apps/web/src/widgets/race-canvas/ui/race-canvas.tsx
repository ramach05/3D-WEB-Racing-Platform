import { type RefObject, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import { PCFShadowMap, type Group, type PointLight } from 'three';
import { Physics, type RapierRigidBody } from '@react-three/rapier';
import type { TTrackConfig } from '@/entities/track';
import { scenePalette } from '@/shared/config';
import { CheckpointDetector } from '@/widgets/race-canvas/model/checkpoint-detector';
import { Vehicle } from '@/widgets/race-canvas/vehicle/vehicle';
import { HorizonMoon } from '@/widgets/race-canvas/world/horizon-moon';
import { HorizonSun } from '@/widgets/race-canvas/world/horizon-sun';
import { TrackStartFinishLine } from '@/widgets/race-canvas/world/track-start-finish-line';
import { TrackTreeColliders } from '@/widgets/race-canvas/world/track-tree-colliders';
import { TrackTrees } from '@/widgets/race-canvas/world/track-trees';
import { TrackTribunes } from '@/widgets/race-canvas/world/track-tribunes';
import { TrackWorld } from '@/widgets/race-canvas/world/track-world';
import { ChaseCamera } from './chase-camera';
import { FramePerfTracker } from './frame-perf-tracker';
import { RacePostFx } from './race-postfx';
import { WebGlContextGuard } from './webgl-context-guard';

type TRaceSceneProps = {
  /** Конфиг трассы и палитры */
  config: TTrackConfig;
  /** Пауза физики Rapier */
  physicsPaused: boolean;
  /** Пауза анимации толпы */
  crowdPaused: boolean;
  /** Счётчик рестарта гонки */
  resetNonce: number;
  /** Колбэк завершения гонки */
  onFinished: () => void;
};

type TCelestialBodyProps = {
  /** Конфиг трассы (день/ночь) */
  config: TTrackConfig;
};

const SUN_HORIZON_POSITION: [number, number, number] = [0, 30, -255];
const MOON_HORIZON_POSITION: [number, number, number] = [-240, 21, 50];
const SUN_LIGHT_POSITION: [number, number, number] = [0, 28, -210];
const MOON_LIGHT_POSITION: [number, number, number] = [-180, 24, 38];
const SKY_SUN_POSITION: [number, number, number] = SUN_LIGHT_POSITION;

/** Солнце днём или луна ночью на уровне горизонта */
const CelestialBody = ({ config }: TCelestialBodyProps) => {
  const isNight = config.timeOfDay === 'night';

  if (isNight) {
    return <HorizonMoon position={MOON_HORIZON_POSITION} />;
  }

  return <HorizonSun position={SUN_HORIZON_POSITION} />;
};

type TNeonAccentLightProps = {
  /** Цвет point light */
  color: string;
};

/** Пульсирующий accent light для night neon */
const NeonAccentLight = ({ color }: TNeonAccentLightProps) => {
  const lightRef = useRef<PointLight>(null);

  // Пульсирует intensity accent light по sin-времени.
  useFrame((state) => {
    if (!lightRef.current) {
      return;
    }
    const breathe = 1 + Math.sin(state.clock.elapsedTime * 2.8) * 0.35;
    lightRef.current.intensity = 1.2 * breathe;
  });

  return (
    <pointLight ref={lightRef} position={[0, 12, 0]} intensity={1.2} color={color} distance={80} />
  );
};

type TRaceSceneInnerProps = TRaceSceneProps & {
  /** Ref физического тела машины */
  bodyRef: RefObject<RapierRigidBody | null>;
  /** Ref визуальной группы кузова */
  visualRef: RefObject<Group | null>;
};

/** Свет, физика, трасса и машина */
const RaceSceneInner = ({
  config,
  physicsPaused,
  crowdPaused,
  resetNonce,
  onFinished,
  bodyRef,
  visualRef,
}: TRaceSceneInnerProps) => {
  const isNight = config.timeOfDay === 'night';

  return (
    <>
      <color attach="background" args={[config.palette.sky]} />
      <fog attach="fog" args={[config.palette.fog, isNight ? 80 : 170, isNight ? 220 : 400]} />
      <hemisphereLight args={[config.palette.sky, config.palette.ground, isNight ? 0.58 : 1.55]} />
      <directionalLight
        position={isNight ? MOON_LIGHT_POSITION : SUN_LIGHT_POSITION}
        intensity={isNight ? 0.85 : 2.65}
        color={isNight ? scenePalette.sunNight : scenePalette.sunDay}
        castShadow
        shadow-mapSize-width={isNight ? 1024 : 2048}
        shadow-mapSize-height={isNight ? 1024 : 2048}
        shadow-bias={-0.0002}
        shadow-normalBias={0.04}
        shadow-camera-near={1}
        shadow-camera-far={320}
        shadow-camera-left={-140}
        shadow-camera-right={140}
        shadow-camera-top={140}
        shadow-camera-bottom={-140}
        shadow-intensity={isNight ? 0.25 : 1}
      />
      <CelestialBody config={config} />
      {isNight ? (
        <>
          <Stars radius={120} depth={40} count={2500} factor={3} saturation={0} fade speed={0.4} />
          <NeonAccentLight color={config.palette.accent} />
        </>
      ) : (
        <Sky
          sunPosition={SKY_SUN_POSITION}
          turbidity={1}
          rayleigh={0.85}
          mieCoefficient={0.005}
          mieDirectionalG={0.92}
        />
      )}
      <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60} updatePriority={-1} paused={physicsPaused}>
        <TrackWorld config={config} resetNonce={resetNonce} />
        <TrackTreeColliders config={config} />
        <Vehicle
          spawnPosition={config.spawnPosition}
          spawnRotationY={config.spawnRotationY}
          resetNonce={resetNonce}
          bodyRef={bodyRef}
          visualRef={visualRef}
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
        paused={crowdPaused}
      />
      <TrackTrees config={config} />
      <CheckpointDetector
        config={config}
        bodyRef={bodyRef}
        resetNonce={resetNonce}
        onFinished={onFinished}
      />
      <ChaseCamera
        target={visualRef}
        spawnPosition={config.spawnPosition}
        spawnRotationY={config.spawnRotationY}
        resetNonce={resetNonce}
      />
      <RacePostFx enabled={isNight} />
      {import.meta.env.DEV ? <FramePerfTracker /> : null}
    </>
  );
};

/** Canvas гонки: отдельно от HUD, чтобы React не убивал FPS */
export const RaceCanvas = ({
  config,
  physicsPaused,
  crowdPaused,
  resetNonce,
  onFinished,
}: TRaceSceneProps) => {
  const bodyRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<Group>(null);

  return (
    <Canvas
      shadows={{ type: PCFShadowMap }}
      dpr={[1, 1.5]}
      camera={{ fov: 60, near: 0.1, far: 500, position: [0, 8, 16] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <WebGlContextGuard />
      <RaceSceneInner
        config={config}
        physicsPaused={physicsPaused}
        crowdPaused={crowdPaused}
        resetNonce={resetNonce}
        onFinished={onFinished}
        bodyRef={bodyRef}
        visualRef={visualRef}
      />
    </Canvas>
  );
};

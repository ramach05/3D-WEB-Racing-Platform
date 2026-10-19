import { type ReactNode, type RefObject, memo, useLayoutEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import {
  PCFSoftShadowMap,
  type DirectionalLight,
  type Group,
  type Object3D,
  type PointLight,
} from 'three';
import { Physics, type RapierRigidBody } from '@react-three/rapier';
import { type TTrackConfig } from '@/entities/track';
import { readSelectedVehicle } from '@/features/vehicle-select';
import { useRaceHudSelector } from '@/features/race-session';
import { scenePalette } from '@/shared/config';
import { CheckpointDetector } from '@/widgets/race-canvas/model/checkpoint-detector';
import { Vehicle } from '@/widgets/race-canvas/vehicle/vehicle';
import { HorizonMoon } from '@/widgets/race-canvas/world/horizon-moon';
import { HorizonSun } from '@/widgets/race-canvas/world/horizon-sun';
import { RainSystem } from '@/widgets/race-canvas/world/rain-system';
import { SkidMarks } from '@/widgets/race-canvas/world/skid-marks';
import { StormSky } from '@/widgets/race-canvas/world/storm-sky';
import { TrackBillboardColliders } from '@/widgets/race-canvas/world/track-billboard-colliders';
import { TrackBillboards } from '@/widgets/race-canvas/world/track-billboards';
import { TrackKerbs } from '@/widgets/race-canvas/world/track-kerbs';
import { TrackOilSlicks } from '@/widgets/race-canvas/world/track-oil-slicks';
import { TrackStartFinishColliders } from '@/widgets/race-canvas/world/track-start-finish-colliders';
import { TrackStartFinishLine } from '@/widgets/race-canvas/world/track-start-finish-line';
import { TrackStreetLightColliders } from '@/widgets/race-canvas/world/track-street-light-colliders';
import { TrackStreetLights } from '@/widgets/race-canvas/world/track-street-lights';
import { TrackTreeColliders } from '@/widgets/race-canvas/world/track-tree-colliders';
import { TrackTrees } from '@/widgets/race-canvas/world/track-trees';
import { TrackTribuneColliders } from '@/widgets/race-canvas/world/track-tribune-colliders';
import { TrackTribunes } from '@/widgets/race-canvas/world/track-tribunes';
import { TrackWorld } from '@/widgets/race-canvas/world/track-world';
import { WheelSpray } from '@/widgets/race-canvas/world/wheel-spray';
import { RaceCamera } from './race-camera';
import { FramePerfTracker } from './frame-perf-tracker';
import { RacePostFx } from './race-postfx';
import { WebGlContextGuard } from './webgl-context-guard';

type TRaceSceneProps = {
  /** Конфиг трассы и палитры */
  config: TTrackConfig;
  /** Счетчик рестарта гонки */
  resetNonce: number;
  /** Колбэк завершения гонки */
  onFinished: () => void;
  /** Один колбэк после первого представленного кадра (для скрытия лоадера) */
  onFirstFrame?: () => void;
};

type TFirstFrameSignalProps = {
  /** Колбэк после первого представленного кадра */
  onFirstFrame?: () => void;
};

/** Сигналит о первом кадре: useFrame идет до render, поэтому ждем еще два rAF после present */
const FirstFrameSignal = ({ onFirstFrame }: TFirstFrameSignalProps) => {
  const firedRef = useRef(false);

  useFrame(() => {
    if (firedRef.current || !onFirstFrame) {
      return;
    }
    firedRef.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(onFirstFrame);
    });
  });

  return null;
};

type TCelestialBodyProps = {
  /** Конфиг трассы (день/ночь) */
  config: TTrackConfig;
};

/** Диск солнца на горизонте — виден из chase-камеры во время заезда */
const SUN_HORIZON_POSITION: [number, number, number] = [0, 30, -255];
const SUN_LIGHT_POSITION: [number, number, number] = [0, 140, -255];
/** Высокое солнце только для Sky (~45°) — ясное голубое небо */
const SKY_SUN_POSITION: [number, number, number] = [80, 140, -120];
const MOON_HORIZON_POSITION: [number, number, number] = [-245, 21, -14];
/** Смещение лунного DirectionalLight относительно машины (направление сохраняется) */
const MOON_LIGHT_OFFSET: [number, number, number] = [-184, 24, -10];
/** Половина ortho-frustum луны вокруг машины — выше texel density без роста mapSize */
const MOON_SHADOW_HALF_EXTENT = 95;
const MOON_SHADOW_MAP = 1024;
const MOON_SHADOW_BIAS = -0.00015;
const MOON_SHADOW_NORMAL_BIAS = 0.03;
const MOON_SHADOW_INTENSITY = 0.5;
const MOON_SHADOW_NEAR = 1;
const MOON_SHADOW_FAR = 320;
const DAY_SHADOW_HALF_EXTENT = 140;
const DAY_SHADOW_MAP = 2048;
/** Квадрат шага follow луны (м²) — реже двигаем shadow camera */
const MOON_FOLLOW_STEP_SQ = 12 * 12;
/** Дождевое «солнце в зените»: источник почти строго вверху, мягкие короткие тени */
const RAIN_LIGHT_OFFSET: [number, number, number] = [0, 300, -22];
const RAIN_SHADOW_HALF_EXTENT = 90;
/** Бюджет ночной луны: свет в зените, тени мягкие/рассеянные — 2048 не читается, а стоит в 4 раза дороже */
const RAIN_SHADOW_MAP = 1024;

/** Солнце (горизонт) днем или луна ночью; в штормовой дождь светила нет (солнце скрыто за облаками) */
const CelestialBody = ({ config }: TCelestialBodyProps) => {
  if (config.weather === 'rain') {
    return null;
  }
  const isNight = config.timeOfDay === 'night';

  if (isNight) {
    return <HorizonMoon position={MOON_HORIZON_POSITION} />;
  }

  return <HorizonSun position={SUN_HORIZON_POSITION} />;
};

type TPrimaryDirectionalLightProps = {
  /** Ночная трасса — луна с follow-frustum */
  isNight: boolean;
  /** Штормовой дождь — невидимое солнце в зените, мягкие тени с follow-frustum */
  isRain: boolean;
  /** Ref машины для центрирования shadow camera */
  bodyRef: RefObject<RapierRigidBody | null>;
  /** Цвет направленного света */
  color: string;
  /** Интенсивность */
  intensity: number;
};

/**
 * Солнце (день) / луна (ночь) / невидимое солнце в зените (дождь).
 * Target — sibling в сцене (не child light): иначе direction = 0 и WebGL падает.
 * Ночью и в дождь light+target сдвигаются шагами ~12 м вокруг машины.
 */
const PrimaryDirectionalLight = ({
  isNight,
  isRain,
  bodyRef,
  color,
  intensity,
}: TPrimaryDirectionalLightProps) => {
  const lightRef = useRef<DirectionalLight>(null);
  const targetRef = useRef<Object3D>(null);
  const followRef = useRef({ x: 0, z: 0, ready: false });
  const follow = isNight || isRain;

  // Привязывает target и ortho frustum.
  useLayoutEffect(() => {
    const light = lightRef.current;
    const target = targetRef.current;
    if (!light || !target) {
      return;
    }
    light.target = target;
    const half = isNight
      ? MOON_SHADOW_HALF_EXTENT
      : isRain
        ? RAIN_SHADOW_HALF_EXTENT
        : DAY_SHADOW_HALF_EXTENT;
    const cam = light.shadow.camera;
    cam.near = MOON_SHADOW_NEAR;
    cam.far = MOON_SHADOW_FAR;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.updateProjectionMatrix();
    followRef.current.ready = false;

    if (!follow) {
      target.position.set(0, 0, 0);
      target.updateMatrixWorld();
      light.position.set(SUN_LIGHT_POSITION[0], SUN_LIGHT_POSITION[1], SUN_LIGHT_POSITION[2]);
    }
  }, [isNight, isRain, follow]);

  // Ночью/в дождь двигает light+target шагами ~12 м (не каждый кадр).
  useFrame(() => {
    if (!follow) {
      return;
    }
    const light = lightRef.current;
    const target = targetRef.current;
    const body = bodyRef.current;
    if (!light || !target || !body) {
      return;
    }
    const { x, z } = body.translation();
    const state = followRef.current;
    if (state.ready) {
      const dx = x - state.x;
      const dz = z - state.z;
      if (dx * dx + dz * dz < MOON_FOLLOW_STEP_SQ) {
        return;
      }
    }
    state.x = x;
    state.z = z;
    state.ready = true;
    const offset = isRain ? RAIN_LIGHT_OFFSET : MOON_LIGHT_OFFSET;
    target.position.set(x, 0, z);
    target.updateMatrixWorld();
    light.position.set(x + offset[0], offset[1], z + offset[2]);
  });

  const mapSize = isNight ? MOON_SHADOW_MAP : isRain ? RAIN_SHADOW_MAP : DAY_SHADOW_MAP;
  const half = isNight
    ? MOON_SHADOW_HALF_EXTENT
    : isRain
      ? RAIN_SHADOW_HALF_EXTENT
      : DAY_SHADOW_HALF_EXTENT;
  const offset = isRain ? RAIN_LIGHT_OFFSET : isNight ? MOON_LIGHT_OFFSET : SUN_LIGHT_POSITION;
  const shadowIntensity = isNight ? MOON_SHADOW_INTENSITY : isRain ? 0.7 : 1;

  return (
    <>
      <object3D ref={targetRef} />
      <directionalLight
        ref={lightRef}
        position={offset}
        intensity={intensity}
        color={color}
        castShadow
        shadow-mapSize-width={mapSize}
        shadow-mapSize-height={mapSize}
        shadow-bias={isNight ? MOON_SHADOW_BIAS : -0.0002}
        shadow-normalBias={isNight ? MOON_SHADOW_NORMAL_BIAS : isRain ? 0.06 : 0.04}
        shadow-camera-near={MOON_SHADOW_NEAR}
        shadow-camera-far={MOON_SHADOW_FAR}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-intensity={shadowIntensity}
      />
    </>
  );
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

type TRacePhysicsProps = {
  /** Тело физики: коллайдеры трассы и машина */
  children: ReactNode;
};

/** Гейт паузы физики по HUD-статусу. Подписка изолирована здесь: смена статуса (countdown/GO/pause) перерисовывает только Physics, а не все дерево сцены. */
const RacePhysics = ({ children }: TRacePhysicsProps) => {
  const paused = useRaceHudSelector(
    (snapshot) =>
      snapshot.status === 'countdown' ||
      snapshot.status === 'paused' ||
      snapshot.status === 'finished',
  );

  return (
    <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60} updatePriority={-1} paused={paused}>
      {children}
    </Physics>
  );
};

/** Свет, физика, трасса и машина */
const RaceSceneInner = ({
  config,
  resetNonce,
  onFinished,
  onFirstFrame,
  bodyRef,
  visualRef,
}: TRaceSceneInnerProps) => {
  const isNight = config.timeOfDay === 'night';
  const isRain = config.weather === 'rain';
  const forcedLights = isNight || isRain;
  const vehicleId = readSelectedVehicle();

  const fogDist = isNight ? 80 : isRain ? 130 : 300;
  const fogFar = isNight ? 220 : isRain ? 400 : 560;
  const hemiIntensity = isNight ? 0.58 : isRain ? 1.15 : 1.28;
  const dirIntensity = isNight ? 0.85 : isRain ? 2.2 : 3.6;
  const dirColor = isNight
    ? scenePalette.sunNight
    : isRain
      ? scenePalette.sunRain
      : scenePalette.sunDay;

  return (
    <>
      <color attach="background" args={[config.palette.sky]} />
      <fog attach="fog" args={[config.palette.fog, fogDist, fogFar]} />
      <hemisphereLight args={[config.palette.sky, config.palette.ground, hemiIntensity]} />
      <PrimaryDirectionalLight
        isNight={isNight}
        isRain={isRain}
        bodyRef={bodyRef}
        intensity={dirIntensity}
        color={dirColor}
      />
      <CelestialBody config={config} />
      {isNight ? (
        <>
          <Stars radius={120} depth={40} count={2500} factor={3} saturation={0} fade speed={0.4} />
          <NeonAccentLight color={config.palette.accent} />
        </>
      ) : isRain ? (
        <StormSky color={config.palette.sky} />
      ) : (
        <Sky
          sunPosition={SKY_SUN_POSITION}
          turbidity={0.3}
          rayleigh={1.1}
          mieCoefficient={0.0035}
          mieDirectionalG={0.82}
        />
      )}
      {isRain && <RainSystem />}
      <RacePhysics>
        <TrackWorld config={config} resetNonce={resetNonce} />
        <TrackTreeColliders config={config} />
        <TrackStreetLightColliders config={config} />
        <TrackBillboardColliders config={config} />
        <TrackTribuneColliders
          line={config.startFinishLine}
          roadWidth={config.roadWidth}
          side={config.startTribuneSide}
        />
        <TrackStartFinishColliders line={config.startFinishLine} roadWidth={config.roadWidth} />
        <Vehicle
          spawnPosition={config.spawnPosition}
          spawnRotationY={config.spawnRotationY}
          resetNonce={resetNonce}
          bodyRef={bodyRef}
          visualRef={visualRef}
          vehicleId={vehicleId}
          carSkin={config.carSkin}
          headlightsOn={forcedLights}
          oilSlicks={config.oilSlicks}
          centerline={config.centerline}
          roadWidth={config.roadWidth}
          roadWidths={config.roadWidths}
          isRain={isRain}
        />
      </RacePhysics>
      <SkidMarks />
      <WheelSpray bodyRef={bodyRef} enabled={isRain} />
      <TrackKerbs config={config} />
      <TrackOilSlicks config={config} />
      <TrackStartFinishLine
        line={config.startFinishLine}
        roadWidth={config.roadWidth}
        palette={config.palette}
        isNight={forcedLights}
      />
      <TrackTribunes
        line={config.startFinishLine}
        roadWidth={config.roadWidth}
        palette={config.palette}
        side={config.startTribuneSide}
        isNight={forcedLights}
      />
      <TrackTrees config={config} />
      <TrackStreetLights config={config} bodyRef={bodyRef} />
      <TrackBillboards config={config} bodyRef={bodyRef} />
      <CheckpointDetector
        config={config}
        bodyRef={bodyRef}
        resetNonce={resetNonce}
        onFinished={onFinished}
      />
      <RaceCamera
        target={visualRef}
        spawnPosition={config.spawnPosition}
        spawnRotationY={config.spawnRotationY}
        resetNonce={resetNonce}
      />
      <RacePostFx enabled={isNight} />
      <FramePerfTracker />
      <FirstFrameSignal onFirstFrame={onFirstFrame} />
    </>
  );
};

/** Canvas гонки: отдельно от HUD, чтобы React не убивал FPS */
const RaceCanvasView = ({ config, resetNonce, onFinished, onFirstFrame }: TRaceSceneProps) => {
  const bodyRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<Group>(null);
  /** Composer (bloom/vignette) только ночью; в дождь — без постобработки и с MSAA */
  const composerActive = config.timeOfDay === 'night';

  return (
    <Canvas
      shadows={{ type: PCFSoftShadowMap }}
      dpr={[1, 1.5]}
      camera={{ fov: 60, near: 0.1, far: 500, position: [0, 8, 16] }}
      gl={{ antialias: !composerActive, powerPreference: 'high-performance' }}
    >
      <WebGlContextGuard />
      <RaceSceneInner
        config={config}
        resetNonce={resetNonce}
        onFinished={onFinished}
        onFirstFrame={onFirstFrame}
        bodyRef={bodyRef}
        visualRef={visualRef}
      />
    </Canvas>
  );
};

/** Мемоизация обязательна: лишний ререндер перестраивает дерево сцены целиком и подвешивает кадр */
export const RaceCanvas = memo(RaceCanvasView);

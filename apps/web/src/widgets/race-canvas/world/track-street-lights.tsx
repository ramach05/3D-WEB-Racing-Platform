import { type RefObject, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Object3D, SpotLight } from 'three';
import type { RapierRigidBody } from '@react-three/rapier';
import {
  isTrackLightingOn,
  placeStreetLamps,
  type TPlacedStreetLamp,
  type TTrackConfig,
} from '@/entities/track';
import { startLightPalette, streetLampPalette } from '@/shared/config';
import {
  STREET_LAMP_ACTIVE_SPOTS,
  STREET_LAMP_ARM_JOINT_OVERLAP,
  STREET_LAMP_ARM_JOINTS,
  STREET_LAMP_ARM_RADIUS,
  STREET_LAMP_HOUSING,
  STREET_LAMP_LENS,
  STREET_LAMP_LENS_EMISSIVE_INTENSITY,
  STREET_LAMP_LUMINAIRE_LOCAL_X,
  STREET_LAMP_LUMINAIRE_Y,
  STREET_LAMP_POLE_HEIGHT,
  STREET_LAMP_POLE_RADIUS,
  STREET_LAMP_POLE_SEGMENTS,
  STREET_LAMP_POLE_TOP_Y,
  STREET_LAMP_ROAD_TOP_Y,
  STREET_LAMP_SPOT,
  STREET_LAMP_SPOT_AIM_LOCAL_X,
  STREET_LAMP_SPOT_SHADOW,
} from '@/widgets/race-canvas/lib/street-lamp';

type TTrackStreetLightsProps = {
  /** Track config */
  config: TTrackConfig;
  /** Car ref — nearest lamps get Spot / shadow */
  bodyRef?: RefObject<RapierRigidBody | null>;
};

type TStreetLampProps = {
  /** Placed street lamp */
  lamp: TPlacedStreetLamp;
  /** Whether the lens is lit (night) */
  isOn: boolean;
  /** Mount SpotLight (distance-LOD) */
  hasSpot: boolean;
  /** This Spot casts the shadow map (only one in the scene) */
  castLightShadow: boolean;
};

type TArmJoint = {
  /** Local X */
  x: number;
  /** Local Y */
  y: number;
};

type TArmSegmentProps = {
  /** Segment start */
  from: TArmJoint;
  /** Segment end */
  to: TArmJoint;
  /** Pipe radius */
  radius: number;
};

/** Bracket cylinder between two joints. Length is slightly greater — overlap hides joint gaps. */
const ArmSegment = ({ from, to, radius }: TArmSegmentProps) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const span = Math.hypot(dx, dy);
  const length = span + STREET_LAMP_ARM_JOINT_OVERLAP;
  /** Cylinder along +Y → rotate on Z so the axis points at (dx, dy) */
  const rotZ = -Math.atan2(dx, dy);

  return (
    <mesh
      position={[(from.x + to.x) / 2, (from.y + to.y) / 2, 0]}
      rotation={[0, 0, rotZ]}
      castShadow
    >
      <cylinderGeometry args={[radius, radius, length, 6]} />
      <meshStandardMaterial color={streetLampPalette.arm} metalness={0.68} roughness={0.4} />
    </mesh>
  );
};

/** Configures the low-budget shadow map of the lamp Spot */
const configureLampSpotShadow = (light: SpotLight) => {
  light.castShadow = true;
  light.shadow.mapSize.set(STREET_LAMP_SPOT_SHADOW.mapSize, STREET_LAMP_SPOT_SHADOW.mapSize);
  light.shadow.bias = STREET_LAMP_SPOT_SHADOW.bias;
  light.shadow.normalBias = STREET_LAMP_SPOT_SHADOW.normalBias;
  light.shadow.camera.near = STREET_LAMP_SPOT_SHADOW.near;
  light.shadow.camera.far = STREET_LAMP_SPOT.distance;
  light.shadow.camera.fov = (2 * STREET_LAMP_SPOT.angle * 180) / Math.PI;
  light.shadow.camera.updateProjectionMatrix();
};

/** One cobra-head lamp: pole, continuous arm, luminaire; Spot only when hasSpot */
const StreetLamp = ({ lamp, isOn, hasSpot, castLightShadow }: TStreetLampProps) => {
  const spotRef = useRef<SpotLight>(null);
  const targetRef = useRef<Object3D>(null);

  // Binds SpotLight to the aim and configures the shadow map outside the render-loop.
  useLayoutEffect(() => {
    if (!hasSpot) {
      return;
    }
    const spot = spotRef.current;
    const target = targetRef.current;
    if (!spot || !target) {
      return;
    }
    spot.target = target;
    spot.target.updateMatrixWorld();
    if (castLightShadow) {
      configureLampSpotShadow(spot);
    } else {
      spot.castShadow = false;
    }
  }, [hasSpot, castLightShadow]);

  const poleCenterY = STREET_LAMP_ROAD_TOP_Y + STREET_LAMP_POLE_HEIGHT / 2;
  const armTipX = STREET_LAMP_LUMINAIRE_LOCAL_X;
  const luminaireY = STREET_LAMP_LUMINAIRE_Y;
  const [poleJoint, elbowJoint, tipJoint] = STREET_LAMP_ARM_JOINTS;

  return (
    <group position={[lamp.x, 0, lamp.z]} rotation={[0, lamp.rotationY, 0]}>
      {/* Pole */}
      <mesh position={[0, poleCenterY, 0]} castShadow receiveShadow>
        <cylinderGeometry
          args={[
            STREET_LAMP_POLE_RADIUS * 0.85,
            STREET_LAMP_POLE_RADIUS,
            STREET_LAMP_POLE_HEIGHT,
            STREET_LAMP_POLE_SEGMENTS,
          ]}
        />
        <meshStandardMaterial color={streetLampPalette.pole} metalness={0.72} roughness={0.38} />
      </mesh>

      {/* Collar at the pole/arm joint */}
      <mesh position={[0, STREET_LAMP_POLE_TOP_Y, 0]} castShadow>
        <cylinderGeometry
          args={[
            STREET_LAMP_POLE_RADIUS * 1.15,
            STREET_LAMP_POLE_RADIUS * 1.25,
            STREET_LAMP_POLE_RADIUS * 2.4,
            STREET_LAMP_POLE_SEGMENTS,
          ]}
        />
        <meshStandardMaterial color={streetLampPalette.arm} metalness={0.7} roughness={0.36} />
      </mesh>

      {/* Arm: two overlapping segments, no gaps */}
      <ArmSegment from={poleJoint} to={elbowJoint} radius={STREET_LAMP_ARM_RADIUS} />
      <ArmSegment from={elbowJoint} to={tipJoint} radius={STREET_LAMP_ARM_RADIUS * 0.92} />

      {/* Luminaire housing — slipped over the arm tip */}
      <mesh position={[armTipX, luminaireY + STREET_LAMP_HOUSING.height * 0.15, 0]} castShadow>
        <boxGeometry
          args={[STREET_LAMP_HOUSING.width, STREET_LAMP_HOUSING.height, STREET_LAMP_HOUSING.depth]}
        />
        <meshStandardMaterial color={streetLampPalette.housing} metalness={0.55} roughness={0.45} />
      </mesh>

      {/* Lens: warm when isOn, dark and off by day */}
      <mesh position={[armTipX, luminaireY - STREET_LAMP_LENS.height * 0.35, 0]}>
        <boxGeometry
          args={[STREET_LAMP_LENS.width, STREET_LAMP_LENS.height, STREET_LAMP_LENS.depth]}
        />
        <meshStandardMaterial
          color={isOn ? streetLampPalette.lens : startLightPalette.idle}
          emissive={isOn ? streetLampPalette.lens : '#000000'}
          emissiveIntensity={isOn ? STREET_LAMP_LENS_EMISSIVE_INTENSITY : 0}
          toneMapped={false}
          metalness={0.05}
          roughness={0.25}
        />
      </mesh>

      {hasSpot ? (
        <>
          {/* Aim: patch on the roadway, not under the pole */}
          <object3D
            ref={targetRef}
            position={[STREET_LAMP_SPOT_AIM_LOCAL_X, STREET_LAMP_ROAD_TOP_Y + 0.05, 0]}
          />

          <spotLight
            ref={spotRef}
            position={[armTipX, luminaireY - 0.08, 0]}
            intensity={STREET_LAMP_SPOT.intensity}
            distance={STREET_LAMP_SPOT.distance}
            angle={STREET_LAMP_SPOT.angle}
            penumbra={STREET_LAMP_SPOT.penumbra}
            decay={STREET_LAMP_SPOT.decay}
            color={streetLampPalette.light}
            castShadow={castLightShadow}
            shadow-mapSize-width={STREET_LAMP_SPOT_SHADOW.mapSize}
            shadow-mapSize-height={STREET_LAMP_SPOT_SHADOW.mapSize}
            shadow-bias={STREET_LAMP_SPOT_SHADOW.bias}
            shadow-normalBias={STREET_LAMP_SPOT_SHADOW.normalBias}
            shadow-camera-near={STREET_LAMP_SPOT_SHADOW.near}
            shadow-camera-far={STREET_LAMP_SPOT.distance}
          />
        </>
      ) : null}
    </group>
  );
};

/** Distance from (x,z) to the lamp */
const lampDistance = (lamp: TPlacedStreetLamp, x: number, z: number): number =>
  Math.hypot(lamp.x - x, lamp.z - z);

/** K nearest lamps with hysteresis: current Spots stay active until farther than K-th + margin. Returns sorted indices (nearest first). */
const selectActiveSpotIndices = (
  lamps: TPlacedStreetLamp[],
  x: number,
  z: number,
  k: number,
  prev: readonly number[],
  hysteresis: number,
): number[] => {
  if (lamps.length === 0 || k <= 0) {
    return [];
  }
  const ranked = lamps.map((lamp, index) => ({ index, d: lampDistance(lamp, x, z) }));
  ranked.sort((a, b) => a.d - b.d);
  const limit = Math.min(k, ranked.length);
  const kthDist = ranked[limit - 1]?.d ?? 0;
  const cutoff = kthDist + hysteresis;

  const next = new Set<number>();
  for (const index of prev) {
    const lamp = lamps[index];
    if (!lamp || next.size >= limit) {
      continue;
    }
    if (lampDistance(lamp, x, z) <= cutoff) {
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
    const da = lampDistance(lamps[a]!, x, z);
    const db = lampDistance(lamps[b]!, x, z);
    return da - db;
  });
};

/** Stable key of an index set for comparison */
const indicesKey = (indices: readonly number[]): string =>
  [...indices].sort((a, b) => a - b).join(',');

/** Street lamps along the track. Poles exist day and night; Spots only on the K nearest at night; shadow on one nearest. */
export const TrackStreetLights = ({ config, bodyRef }: TTrackStreetLightsProps) => {
  const lamps = useMemo(() => placeStreetLamps({ config }), [config]);
  const isOn = isTrackLightingOn(config);
  const initialActive = useMemo(
    () => lamps.slice(0, STREET_LAMP_ACTIVE_SPOTS.count).map((_, i) => i),
    [lamps],
  );
  const [activeSpotIndices, setActiveSpotIndices] = useState<number[]>(initialActive);
  const [shadowLampIndex, setShadowLampIndex] = useState(initialActive[0] ?? 0);
  const activeRef = useRef(initialActive);
  const shadowIndexRef = useRef(initialActive[0] ?? 0);
  const pendingActiveKeyRef = useRef<string | null>(null);
  const pendingShadowRef = useRef<number | null>(null);

  // Updates the active Spot set and shadow caster; setState runs after the frame.
  useFrame(() => {
    if (!isOn || !bodyRef?.current || lamps.length === 0) {
      return;
    }
    const { x, z } = bodyRef.current.translation();
    const nextActive = selectActiveSpotIndices(
      lamps,
      x,
      z,
      STREET_LAMP_ACTIVE_SPOTS.count,
      activeRef.current,
      STREET_LAMP_ACTIVE_SPOTS.switchHysteresis,
    );
    const nextKey = indicesKey(nextActive);
    const prevKey = indicesKey(activeRef.current);
    if (nextKey !== prevKey && pendingActiveKeyRef.current !== nextKey) {
      pendingActiveKeyRef.current = nextKey;
      activeRef.current = nextActive;
      queueMicrotask(() => {
        setActiveSpotIndices(nextActive);
        pendingActiveKeyRef.current = null;
      });
    }

    const nearest = nextActive[0] ?? findNearestLampIndex(lamps, x, z);
    if (nearest < 0) {
      return;
    }
    const current = shadowIndexRef.current;
    if (current === nearest) {
      return;
    }
    const currentLamp = lamps[current];
    const nearestLamp = lamps[nearest];
    if (!nearestLamp) {
      return;
    }
    let nextShadow = current;
    if (!currentLamp) {
      nextShadow = nearest;
    } else {
      const currentDist = lampDistance(currentLamp, x, z);
      const nearestDist = lampDistance(nearestLamp, x, z);
      if (nearestDist + STREET_LAMP_SPOT_SHADOW.switchHysteresis < currentDist) {
        nextShadow = nearest;
      }
    }
    if (nextShadow === current || pendingShadowRef.current === nextShadow) {
      return;
    }
    pendingShadowRef.current = nextShadow;
    shadowIndexRef.current = nextShadow;
    queueMicrotask(() => {
      setShadowLampIndex(nextShadow);
      pendingShadowRef.current = null;
    });
  });

  const activeSet = useMemo(() => new Set(activeSpotIndices), [activeSpotIndices]);

  if (lamps.length === 0) {
    return null;
  }

  return (
    <group>
      {lamps.map((lamp, index) => (
        <StreetLamp
          key={`street-lamp-${index}`}
          lamp={lamp}
          isOn={isOn}
          hasSpot={isOn && activeSet.has(index)}
          castLightShadow={isOn && index === shadowLampIndex}
        />
      ))}
    </group>
  );
};

/** Index of the lamp nearest to (x, z); -1 when the list is empty */
const findNearestLampIndex = (lamps: TPlacedStreetLamp[], x: number, z: number): number => {
  let bestIndex = -1;
  let bestDistSq = Number.POSITIVE_INFINITY;
  for (let i = 0; i < lamps.length; i += 1) {
    const lamp = lamps[i];
    if (!lamp) {
      continue;
    }
    const dx = lamp.x - x;
    const dz = lamp.z - z;
    const distSq = dx * dx + dz * dz;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestIndex = i;
    }
  }
  return bestIndex;
};

import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Object3D, SpotLight } from 'three';
import { placeStreetLamps, type TPlacedStreetLamp, type TTrackConfig } from '@/entities/track';
import { streetLampPalette } from '@/shared/config';
import {
  STREET_LAMP_ARM_RADIUS,
  STREET_LAMP_ARM_REACH,
  STREET_LAMP_ARM_RISE,
  STREET_LAMP_HOUSING,
  STREET_LAMP_LENS,
  STREET_LAMP_LENS_EMISSIVE_INTENSITY,
  STREET_LAMP_LUMINAIRE_LOCAL_X,
  STREET_LAMP_LUMINAIRE_Y,
  STREET_LAMP_POINT,
  STREET_LAMP_POLE_HEIGHT,
  STREET_LAMP_POLE_RADIUS,
  STREET_LAMP_POLE_SEGMENTS,
  STREET_LAMP_ROAD_TOP_Y,
  STREET_LAMP_SPOT,
  STREET_LAMP_SPOT_AIM_LOCAL_X,
} from '@/widgets/race-canvas/lib/street-lamp';

type TTrackStreetLightsProps = {
  /** Конфиг трассы */
  config: TTrackConfig;
};

type TStreetLampProps = {
  /** Размещённый фонарь */
  lamp: TPlacedStreetLamp;
};

/** Один cobra-head фонарь: столб, кронштейн, плафон, SpotLight на асфальт */
const StreetLamp = ({ lamp }: TStreetLampProps) => {
  const spotRef = useRef<SpotLight>(null);
  const targetRef = useRef<Object3D>(null);

  // Привязывает SpotLight к точке на дороге под плафоном.
  useLayoutEffect(() => {
    const spot = spotRef.current;
    const target = targetRef.current;
    if (!spot || !target) {
      return;
    }
    spot.target = target;
    spot.target.updateMatrixWorld();
  }, []);

  const poleCenterY = STREET_LAMP_ROAD_TOP_Y + STREET_LAMP_POLE_HEIGHT / 2;
  const armBaseY = STREET_LAMP_ROAD_TOP_Y + STREET_LAMP_POLE_HEIGHT;
  const luminaireY = STREET_LAMP_LUMINAIRE_Y;
  const armMidX = STREET_LAMP_ARM_REACH * 0.45;
  const armTipX = STREET_LAMP_LUMINAIRE_LOCAL_X;

  return (
    <group position={[lamp.x, 0, lamp.z]} rotation={[0, lamp.rotationY, 0]}>
      {/* Столб */}
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

      {/* Нижний сегмент кронштейна */}
      <mesh
        position={[armMidX * 0.55, armBaseY + STREET_LAMP_ARM_RISE * 0.55, 0]}
        rotation={[0, 0, -0.55]}
        castShadow
      >
        <cylinderGeometry
          args={[STREET_LAMP_ARM_RADIUS, STREET_LAMP_ARM_RADIUS, STREET_LAMP_ARM_REACH * 0.55, 6]}
        />
        <meshStandardMaterial color={streetLampPalette.arm} metalness={0.68} roughness={0.4} />
      </mesh>

      {/* Горизонтальный вылет к плафону */}
      <mesh
        position={[armTipX * 0.72, luminaireY + 0.06, 0]}
        rotation={[0, 0, -Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry
          args={[
            STREET_LAMP_ARM_RADIUS * 0.9,
            STREET_LAMP_ARM_RADIUS * 0.9,
            STREET_LAMP_ARM_REACH * 0.55,
            6,
          ]}
        />
        <meshStandardMaterial color={streetLampPalette.arm} metalness={0.68} roughness={0.4} />
      </mesh>

      {/* Корпус плафона */}
      <mesh position={[armTipX, luminaireY + STREET_LAMP_HOUSING.height * 0.35, 0]} castShadow>
        <boxGeometry
          args={[STREET_LAMP_HOUSING.width, STREET_LAMP_HOUSING.height, STREET_LAMP_HOUSING.depth]}
        />
        <meshStandardMaterial color={streetLampPalette.housing} metalness={0.55} roughness={0.45} />
      </mesh>

      {/* Тёплая линза */}
      <mesh position={[armTipX, luminaireY - STREET_LAMP_LENS.height * 0.2, 0]}>
        <boxGeometry
          args={[STREET_LAMP_LENS.width, STREET_LAMP_LENS.height, STREET_LAMP_LENS.depth]}
        />
        <meshStandardMaterial
          color={streetLampPalette.lens}
          emissive={streetLampPalette.lens}
          emissiveIntensity={STREET_LAMP_LENS_EMISSIVE_INTENSITY}
          toneMapped={false}
          metalness={0.05}
          roughness={0.25}
        />
      </mesh>

      {/* Aim: пятно на проезжей части, не под столб */}
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
        castShadow={false}
      />

      <pointLight
        position={[armTipX, luminaireY - 0.05, 0]}
        intensity={STREET_LAMP_POINT.intensity}
        distance={STREET_LAMP_POINT.distance}
        decay={STREET_LAMP_POINT.decay}
        color={streetLampPalette.light}
        castShadow={false}
      />
    </group>
  );
};

/**
 * Уличные фонари вдоль ночной трассы.
 * Днём не рендерится.
 */
export const TrackStreetLights = ({ config }: TTrackStreetLightsProps) => {
  const lamps = useMemo(() => placeStreetLamps({ config }), [config]);

  if (config.timeOfDay !== 'night' || lamps.length === 0) {
    return null;
  }

  return (
    <group>
      {lamps.map((lamp, index) => (
        <StreetLamp key={`street-lamp-${index}`} lamp={lamp} />
      ))}
    </group>
  );
};

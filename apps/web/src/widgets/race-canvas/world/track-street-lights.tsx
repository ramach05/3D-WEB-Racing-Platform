import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Object3D, SpotLight } from 'three';
import { placeStreetLamps, type TPlacedStreetLamp, type TTrackConfig } from '@/entities/track';
import { startLightPalette, streetLampPalette } from '@/shared/config';
import {
  STREET_LAMP_ARM_JOINT_OVERLAP,
  STREET_LAMP_ARM_JOINTS,
  STREET_LAMP_ARM_RADIUS,
  STREET_LAMP_HOUSING,
  STREET_LAMP_LENS,
  STREET_LAMP_LENS_EMISSIVE_INTENSITY,
  STREET_LAMP_LUMINAIRE_LOCAL_X,
  STREET_LAMP_LUMINAIRE_Y,
  STREET_LAMP_POINT,
  STREET_LAMP_POLE_HEIGHT,
  STREET_LAMP_POLE_RADIUS,
  STREET_LAMP_POLE_SEGMENTS,
  STREET_LAMP_POLE_TOP_Y,
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
  /** Горит ли фонарь */
  isOn: boolean;
};

type TArmJoint = {
  /** Локальный X */
  x: number;
  /** Локальный Y */
  y: number;
};

type TArmSegmentProps = {
  /** Начало сегмента */
  from: TArmJoint;
  /** Конец сегмента */
  to: TArmJoint;
  /** Радиус трубы */
  radius: number;
};

/**
 * Цилиндр кронштейна между двумя суставами.
 * Длина чуть больше расстояния — overlap закрывает щели в суставах.
 */
const ArmSegment = ({ from, to, radius }: TArmSegmentProps) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const span = Math.hypot(dx, dy);
  const length = span + STREET_LAMP_ARM_JOINT_OVERLAP;
  /** Cylinder вдоль +Y → поворот Z так, чтобы ось смотрела в (dx, dy) */
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

/** Один cobra-head фонарь: столб, непрерывный кронштейн, плафон; свет — только при isOn */
const StreetLamp = ({ lamp, isOn }: TStreetLampProps) => {
  const spotRef = useRef<SpotLight>(null);
  const targetRef = useRef<Object3D>(null);

  // Привязывает SpotLight к точке на дороге под плафоном.
  useLayoutEffect(() => {
    if (!isOn) {
      return;
    }
    const spot = spotRef.current;
    const target = targetRef.current;
    if (!spot || !target) {
      return;
    }
    spot.target = target;
    spot.target.updateMatrixWorld();
  }, [isOn]);

  const poleCenterY = STREET_LAMP_ROAD_TOP_Y + STREET_LAMP_POLE_HEIGHT / 2;
  const armTipX = STREET_LAMP_LUMINAIRE_LOCAL_X;
  const luminaireY = STREET_LAMP_LUMINAIRE_Y;
  const [poleJoint, elbowJoint, tipJoint] = STREET_LAMP_ARM_JOINTS;

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

      {/* Воротник у стыка столб/кронштейн */}
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

      {/* Кронштейн: два перекрывающихся сегмента без щелей */}
      <ArmSegment from={poleJoint} to={elbowJoint} radius={STREET_LAMP_ARM_RADIUS} />
      <ArmSegment from={elbowJoint} to={tipJoint} radius={STREET_LAMP_ARM_RADIUS * 0.92} />

      {/* Корпус плафона — насаживается на конец кронштейна */}
      <mesh position={[armTipX, luminaireY + STREET_LAMP_HOUSING.height * 0.15, 0]} castShadow>
        <boxGeometry
          args={[STREET_LAMP_HOUSING.width, STREET_LAMP_HOUSING.height, STREET_LAMP_HOUSING.depth]}
        />
        <meshStandardMaterial color={streetLampPalette.housing} metalness={0.55} roughness={0.45} />
      </mesh>

      {/* Линза: тёплая при isOn, тёмная выключенная днём */}
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

      {isOn ? (
        <>
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
        </>
      ) : null}
    </group>
  );
};

/**
 * Уличные фонари вдоль трассы.
 * Столбы есть днём и ночью; свет — только при `timeOfDay === 'night'`.
 */
export const TrackStreetLights = ({ config }: TTrackStreetLightsProps) => {
  const lamps = useMemo(() => placeStreetLamps({ config }), [config]);
  const isOn = config.timeOfDay === 'night';

  if (lamps.length === 0) {
    return null;
  }

  return (
    <group>
      {lamps.map((lamp, index) => (
        <StreetLamp key={`street-lamp-${index}`} lamp={lamp} isOn={isOn} />
      ))}
    </group>
  );
};

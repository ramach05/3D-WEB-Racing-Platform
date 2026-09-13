import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { MeshStandardMaterial, Object3D, SpotLight } from 'three';
import type { TOrientedBox, TTrackPalette } from '@/entities/track';
import { getRaceHudSnapshot } from '@/features/race-session';
import { scenePalette, startLightPalette } from '@/shared/config';
import {
  GANTRY_BEAM_CLEARANCE_Y,
  GANTRY_BEAM_DEPTH,
  GANTRY_BEAM_HEIGHT,
  GANTRY_FLOOD,
  GANTRY_FLOOD_PLACEMENTS,
  GANTRY_FLOOD_POINT,
  GANTRY_FLOOD_SPOT,
  GANTRY_PANEL_DEPTH,
  GANTRY_PANEL_HEIGHT,
  GANTRY_PANEL_WIDTH,
  GANTRY_POST_DEPTH,
  GANTRY_POST_OUTSET,
  GANTRY_POST_WIDTH,
  GANTRY_ROAD_TOP_Y,
  isFinishLampBlinkOn,
  isLampLit,
  litCountForHud,
  START_LAMP_COUNT,
} from '@/widgets/race-canvas/lib/start-light-gantry';

type TTrackStartFinishLineProps = {
  /** Ориентированный бокс линии */
  line: TOrientedBox;
  /** Ширина дороги для разметки */
  roadWidth: number;
  /** Палитра трассы (accent стрелок / финиша) */
  palette: TTrackPalette;
  /** Ночные stadium-прожекторы на gantry */
  isNight: boolean;
};

type TGantryFloodLightProps = {
  /** Абсолютный X поста (со знаком) */
  postX: number;
  /** Сторона линии: +1 спавн, −1 финишный проезд */
  sideZ: 1 | -1;
  /** Y центра балки */
  beamY: number;
  /** Ширина дороги для aim */
  roadWidth: number;
  /** Горит ли прожектор */
  isOn: boolean;
};

const CHECKER_COUNT = 10;
/** Дистанции стрелок на стороне спавна (+local Z / +lz); заезд идёт к линии и в −lz. */
const ARROW_DISTANCES = [2, 4, 6] as const;
const MARKING_Y = GANTRY_ROAD_TOP_Y + 0.002;
const LAMP_RADIUS = 0.22;
const LAMP_SPACING = 0.62;

const LAMP_XS = Array.from({ length: START_LAMP_COUNT }, (_, i) => {
  const centered = i - (START_LAMP_COUNT - 1) / 2;
  return centered * LAMP_SPACING;
});

/** Один stadium-прожектор на столбе gantry: корпус, линза, SpotLight на асфальт */
const GantryFloodLight = ({ postX, sideZ, beamY, roadWidth, isOn }: TGantryFloodLightProps) => {
  const spotRef = useRef<SpotLight>(null);
  const targetRef = useRef<Object3D>(null);

  const sideX = postX >= 0 ? 1 : -1;
  const housingX = postX - sideX * GANTRY_FLOOD.housingInsetX;
  const housingY = beamY - GANTRY_FLOOD.housingDropY;
  const housingZ = sideZ * GANTRY_FLOOD.housingOutsetZ;
  const aimX = sideX * (roadWidth / 2) * GANTRY_FLOOD.aimXFraction;
  const aimZ = sideZ * GANTRY_FLOOD.aimZ;

  // Привязывает SpotLight к точке на асфальте у линии.
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

  return (
    <group position={[housingX, housingY, housingZ]}>
      <mesh castShadow rotation={[sideZ > 0 ? 0.55 : -0.55, 0, sideX * 0.2]}>
        <boxGeometry
          args={[GANTRY_FLOOD.housing.width, GANTRY_FLOOD.housing.height, GANTRY_FLOOD.housing.depth]}
        />
        <meshStandardMaterial
          color={startLightPalette.housing}
          metalness={0.55}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[0, -GANTRY_FLOOD.housing.height * 0.35, sideZ * 0.04]}>
        <sphereGeometry args={[GANTRY_FLOOD.bulbRadius, 12, 10]} />
        <meshStandardMaterial
          color={isOn ? startLightPalette.floodLight : startLightPalette.idle}
          emissive={isOn ? startLightPalette.floodLight : '#000000'}
          emissiveIntensity={isOn ? GANTRY_FLOOD.lensEmissiveIntensity : 0}
          metalness={0.1}
          roughness={0.3}
          toneMapped={false}
        />
      </mesh>

      {isOn ? (
        <>
          <spotLight
            ref={spotRef}
            position={[0, -0.06, sideZ * 0.02]}
            color={startLightPalette.floodLight}
            intensity={GANTRY_FLOOD_SPOT.intensity}
            distance={GANTRY_FLOOD_SPOT.distance}
            angle={GANTRY_FLOOD_SPOT.angle}
            penumbra={GANTRY_FLOOD_SPOT.penumbra}
            decay={GANTRY_FLOOD_SPOT.decay}
            castShadow={false}
          />
          <object3D
            ref={targetRef}
            position={[aimX - housingX, GANTRY_ROAD_TOP_Y - housingY, aimZ - housingZ]}
          />
        </>
      ) : null}
    </group>
  );
};

/** Шахматная линия старт/финиш, стрелки и F1-gantry со стартовыми огнями */
export const TrackStartFinishLine = ({
  line,
  roadWidth,
  palette,
  isNight,
}: TTrackStartFinishLineProps) => {
  const segmentWidth = roadWidth / CHECKER_COUNT;
  const postX = roadWidth / 2 + GANTRY_POST_OUTSET;
  const spanWidth = postX * 2 + GANTRY_POST_WIDTH;
  const postHeight = GANTRY_BEAM_CLEARANCE_Y + GANTRY_BEAM_HEIGHT / 2;
  const beamY = GANTRY_ROAD_TOP_Y + GANTRY_BEAM_CLEARANCE_Y;
  const panelY = beamY + GANTRY_BEAM_HEIGHT / 2 + GANTRY_PANEL_HEIGHT / 2 + 0.02;

  const leftPostMatRef = useRef<MeshStandardMaterial>(null);
  const rightPostMatRef = useRef<MeshStandardMaterial>(null);
  const beamMatRef = useRef<MeshStandardMaterial>(null);
  const panelMatRef = useRef<MeshStandardMaterial>(null);
  const lamp0MatRef = useRef<MeshStandardMaterial>(null);
  const lamp1MatRef = useRef<MeshStandardMaterial>(null);
  const lamp2MatRef = useRef<MeshStandardMaterial>(null);
  const lamp3MatRef = useRef<MeshStandardMaterial>(null);
  const lamp4MatRef = useRef<MeshStandardMaterial>(null);
  const pulseRef = useRef(0);

  // Обновляет стартовые лампы и лёгкий пульс конструкции по HUD-статусу.
  useFrame((_, dt) => {
    const hud = getRaceHudSnapshot();
    pulseRef.current += dt;
    const litCount = litCountForHud(hud.status, hud.countdownStep);
    const countdownPulse = 0.55 + Math.sin(pulseRef.current * 4) * 0.35;
    const finishBlinkOn =
      hud.status === 'finished' && isFinishLampBlinkOn(pulseRef.current);

    const lampMats = [
      lamp0MatRef.current,
      lamp1MatRef.current,
      lamp2MatRef.current,
      lamp3MatRef.current,
      lamp4MatRef.current,
    ];
    for (let i = 0; i < START_LAMP_COUNT; i += 1) {
      const mat = lampMats[i];
      if (!mat) {
        continue;
      }
      if (hud.status === 'finished') {
        const color = finishBlinkOn ? startLightPalette.amber : startLightPalette.idle;
        mat.color.set(color);
        mat.emissive.set(color);
        mat.emissiveIntensity = finishBlinkOn ? 2.2 : 0.35;
        continue;
      }
      const on = isLampLit(i, litCount);
      const color = on ? startLightPalette.red : startLightPalette.idle;
      mat.color.set(color);
      mat.emissive.set(color);
      mat.emissiveIntensity = on ? 2.2 * countdownPulse : 0.35;
    }

    const structurePulse = hud.status === 'countdown' ? 0.12 : 0.05;
    for (const mat of [
      leftPostMatRef.current,
      rightPostMatRef.current,
      beamMatRef.current,
      panelMatRef.current,
    ]) {
      if (!mat) {
        continue;
      }
      mat.emissive.set(startLightPalette.steelDark);
      mat.emissiveIntensity = structurePulse;
    }
  });

  const lampMatRefs = [lamp0MatRef, lamp1MatRef, lamp2MatRef, lamp3MatRef, lamp4MatRef] as const;

  return (
    <group position={[line.position[0], 0, line.position[2]]} rotation={[0, line.rotationY, 0]}>
      {Array.from({ length: CHECKER_COUNT }, (_, index) => {
        const x = -roadWidth / 2 + segmentWidth / 2 + index * segmentWidth;
        const isWhite = index % 2 === 0;
        return (
          <mesh key={`checker-${index}`} position={[x, MARKING_Y, 0]} receiveShadow>
            <boxGeometry args={[segmentWidth, 0.004, 0.15]} />
            <meshStandardMaterial
              color={isWhite ? scenePalette.white : scenePalette.checkerDark}
              roughness={0.85}
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-1}
            />
          </mesh>
        );
      })}

      {/* F1 start-light gantry (визуал; коллайдеры — TrackStartFinishColliders) */}
      <mesh position={[-postX, GANTRY_ROAD_TOP_Y + postHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[GANTRY_POST_WIDTH, postHeight, GANTRY_POST_DEPTH]} />
        <meshStandardMaterial
          ref={leftPostMatRef}
          color={startLightPalette.steel}
          emissive={startLightPalette.steelDark}
          emissiveIntensity={0.05}
          metalness={0.65}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[postX, GANTRY_ROAD_TOP_Y + postHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[GANTRY_POST_WIDTH, postHeight, GANTRY_POST_DEPTH]} />
        <meshStandardMaterial
          ref={rightPostMatRef}
          color={startLightPalette.steel}
          emissive={startLightPalette.steelDark}
          emissiveIntensity={0.05}
          metalness={0.65}
          roughness={0.4}
        />
      </mesh>

      <mesh position={[0, beamY, 0]} castShadow receiveShadow>
        <boxGeometry args={[spanWidth, GANTRY_BEAM_HEIGHT, GANTRY_BEAM_DEPTH]} />
        <meshStandardMaterial
          ref={beamMatRef}
          color={startLightPalette.steel}
          emissive={startLightPalette.steelDark}
          emissiveIntensity={0.05}
          metalness={0.6}
          roughness={0.38}
        />
      </mesh>

      {/* Панель и лампы на +Z: спавн/подъезд со стороны +local Z */}
      <mesh position={[0, panelY, GANTRY_BEAM_DEPTH * 0.15]} castShadow>
        <boxGeometry args={[GANTRY_PANEL_WIDTH, GANTRY_PANEL_HEIGHT, GANTRY_PANEL_DEPTH]} />
        <meshStandardMaterial
          ref={panelMatRef}
          color={startLightPalette.housing}
          emissive={startLightPalette.steelDark}
          emissiveIntensity={0.05}
          metalness={0.35}
          roughness={0.55}
        />
      </mesh>

      {LAMP_XS.map((x, index) => (
        <group
          key={`start-lamp-${index}`}
          position={[x, panelY, GANTRY_BEAM_DEPTH * 0.15 + GANTRY_PANEL_DEPTH / 2 + 0.06]}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[LAMP_RADIUS + 0.06, LAMP_RADIUS + 0.06, 0.08, 20]} />
            <meshStandardMaterial
              color={startLightPalette.bezel}
              metalness={0.55}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <sphereGeometry args={[LAMP_RADIUS, 16, 16]} />
            <meshStandardMaterial
              ref={lampMatRefs[index]}
              color={startLightPalette.idle}
              emissive={startLightPalette.idle}
              emissiveIntensity={0.35}
              roughness={0.18}
              metalness={0.05}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {GANTRY_FLOOD_PLACEMENTS.map(({ sideX, sideZ }) => (
        <GantryFloodLight
          key={`gantry-flood-${sideX}-${sideZ}`}
          postX={sideX * postX}
          sideZ={sideZ}
          beamY={beamY}
          roadWidth={roadWidth}
          isOn={isNight}
        />
      ))}

      {isNight ? (
        <>
          <pointLight
            position={[-postX, beamY - 0.8, 0]}
            color={startLightPalette.floodLight}
            intensity={GANTRY_FLOOD_POINT.intensity}
            distance={GANTRY_FLOOD_POINT.distance}
            decay={GANTRY_FLOOD_POINT.decay}
          />
          <pointLight
            position={[postX, beamY - 0.8, 0]}
            color={startLightPalette.floodLight}
            intensity={GANTRY_FLOOD_POINT.intensity}
            distance={GANTRY_FLOOD_POINT.distance}
            decay={GANTRY_FLOOD_POINT.decay}
          />
        </>
      ) : null}

      {ARROW_DISTANCES.map((distance) => (
        <group key={`arrow-${distance}`} position={[0, MARKING_Y, distance]}>
          {[-0.55, 0.55].map((xOffset) => (
            <mesh
              key={`chevron-${distance}-${xOffset}`}
              position={[xOffset, 0, 0]}
              rotation={[0, xOffset > 0 ? -Math.PI / 4 : Math.PI / 4, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[0.9, 0.004, 0.18]} />
              <meshStandardMaterial
                color={palette.accent}
                emissive={palette.accent}
                emissiveIntensity={0.7}
                roughness={0.45}
                polygonOffset
                polygonOffsetFactor={-1}
                polygonOffsetUnits={-1}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};

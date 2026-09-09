import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { MeshStandardMaterial } from 'three';
import type { TOrientedBox, TTrackPalette } from '@/entities/track';
import { getRaceHudSnapshot } from '@/features/race-session';
import { scenePalette, startLightPalette } from '@/shared/config';
import {
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
};

const CHECKER_COUNT = 10;
const ARROW_DISTANCES = [2, 4, 6] as const;
const ROAD_TOP_Y = 0.1;
const MARKING_Y = ROAD_TOP_Y + 0.002;

const POST_OUTSET = 0.55;
const POST_WIDTH = 0.28;
const POST_DEPTH = 0.28;
const BEAM_CLEARANCE_Y = 4.6;
const BEAM_HEIGHT = 0.28;
const BEAM_DEPTH = 0.36;
const PANEL_WIDTH = 3.6;
const PANEL_HEIGHT = 0.85;
const PANEL_DEPTH = 0.28;
const LAMP_RADIUS = 0.22;
const LAMP_SPACING = 0.62;

const LAMP_XS = Array.from({ length: START_LAMP_COUNT }, (_, i) => {
  const centered = i - (START_LAMP_COUNT - 1) / 2;
  return centered * LAMP_SPACING;
});

/** Шахматная линия старт/финиш, стрелки и F1-gantry со стартовыми огнями */
export const TrackStartFinishLine = ({ line, roadWidth, palette }: TTrackStartFinishLineProps) => {
  const segmentWidth = roadWidth / CHECKER_COUNT;
  const postX = roadWidth / 2 + POST_OUTSET;
  const spanWidth = postX * 2 + POST_WIDTH;
  const postHeight = BEAM_CLEARANCE_Y + BEAM_HEIGHT / 2;
  const beamY = ROAD_TOP_Y + BEAM_CLEARANCE_Y;
  const panelY = beamY + BEAM_HEIGHT / 2 + PANEL_HEIGHT / 2 + 0.02;

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
      const on = isLampLit(i, litCount);
      const color = on ? startLightPalette.red : startLightPalette.idle;
      mat.color.set(color);
      mat.emissive.set(color);
      mat.emissiveIntensity = on ? 2.2 * countdownPulse : 0.35;
    }

    const structurePulse =
      hud.status === 'finished'
        ? 0.55 + Math.sin(pulseRef.current * 6) * 0.4
        : hud.status === 'countdown'
          ? 0.12
          : 0.05;
    for (const mat of [
      leftPostMatRef.current,
      rightPostMatRef.current,
      beamMatRef.current,
      panelMatRef.current,
    ]) {
      if (!mat) {
        continue;
      }
      mat.emissive.set(hud.status === 'finished' ? palette.accent : startLightPalette.steelDark);
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

      {/* F1 start-light gantry */}
      <mesh position={[-postX, ROAD_TOP_Y + postHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[POST_WIDTH, postHeight, POST_DEPTH]} />
        <meshStandardMaterial
          ref={leftPostMatRef}
          color={startLightPalette.steel}
          emissive={startLightPalette.steelDark}
          emissiveIntensity={0.05}
          metalness={0.65}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[postX, ROAD_TOP_Y + postHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[POST_WIDTH, postHeight, POST_DEPTH]} />
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
        <boxGeometry args={[spanWidth, BEAM_HEIGHT, BEAM_DEPTH]} />
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
      <mesh position={[0, panelY, BEAM_DEPTH * 0.15]} castShadow>
        <boxGeometry args={[PANEL_WIDTH, PANEL_HEIGHT, PANEL_DEPTH]} />
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
          position={[x, panelY, BEAM_DEPTH * 0.15 + PANEL_DEPTH / 2 + 0.06]}
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

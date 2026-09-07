import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { MeshStandardMaterial } from 'three';
import type { TOrientedBox, TTrackPalette } from '@/entities/track';
import { getRaceHudSnapshot } from '@/features/race-session';

type TTrackStartFinishLineProps = {
  line: TOrientedBox;
  roadWidth: number;
  palette: TTrackPalette;
};

const CHECKER_COUNT = 10;
const ARROW_DISTANCES = [2, 4, 6] as const;
const ROAD_TOP_Y = 0.1;
const MARKING_Y = ROAD_TOP_Y + 0.002;

const LIGHT_COLORS = {
  idle: '#334155',
  red: '#ff2244',
  amber: '#ffcc00',
  green: '#33ff66',
} as const;

/** Шахматная линия старт/финиш, стрелки и огни 3-2-1 */
export const TrackStartFinishLine = ({ line, roadWidth, palette }: TTrackStartFinishLineProps) => {
  const segmentWidth = roadWidth / CHECKER_COUNT;
  const gateHalfWidth = roadWidth / 2 + 0.75;
  const leftLightRef = useRef<MeshStandardMaterial>(null);
  const rightLightRef = useRef<MeshStandardMaterial>(null);
  const leftPostRef = useRef<MeshStandardMaterial>(null);
  const rightPostRef = useRef<MeshStandardMaterial>(null);
  const pulseRef = useRef(0);

  useFrame((_, dt) => {
    const hud = getRaceHudSnapshot();
    pulseRef.current += dt;
    const pulse = 0.55 + Math.sin(pulseRef.current * 4) * 0.35;

    let color: string = LIGHT_COLORS.idle;
    let intensity = 0.35;

    if (hud.status === 'countdown') {
      const step = hud.countdownStep;
      if (step === 3 || step === 2) {
        color = LIGHT_COLORS.red;
        intensity = 1.4 * pulse;
      } else if (step === 1) {
        color = LIGHT_COLORS.amber;
        intensity = 1.5 * pulse;
      } else if (step === 0) {
        color = LIGHT_COLORS.green;
        intensity = 1.8;
      }
    } else if (hud.status === 'racing') {
      color = LIGHT_COLORS.green;
      intensity = 0.55;
    } else if (hud.status === 'finished') {
      color = palette.accent;
      intensity = 0.9 + Math.sin(pulseRef.current * 6) * 0.45;
    } else {
      color = palette.accent;
      intensity = 0.75 + Math.sin(pulseRef.current * 2.2) * 0.2;
    }

    for (const mat of [leftLightRef.current, rightLightRef.current]) {
      if (!mat) {
        continue;
      }
      mat.color.set(color);
      mat.emissive.set(color);
      mat.emissiveIntensity = intensity;
    }

    const postPulse =
      hud.status === 'finished' || hud.status === 'countdown'
        ? 0.9 + Math.sin(pulseRef.current * 5) * 0.5
        : 0.75 + Math.sin(pulseRef.current * 1.8) * 0.15;
    for (const mat of [leftPostRef.current, rightPostRef.current]) {
      if (!mat) {
        continue;
      }
      mat.emissiveIntensity = postPulse;
    }
  });

  return (
    <group position={[line.position[0], 0, line.position[2]]} rotation={[0, line.rotationY, 0]}>
      {Array.from({ length: CHECKER_COUNT }, (_, index) => {
        const x = -roadWidth / 2 + segmentWidth / 2 + index * segmentWidth;
        const isWhite = index % 2 === 0;
        return (
          <mesh key={`checker-${index}`} position={[x, MARKING_Y, 0]} receiveShadow>
            <boxGeometry args={[segmentWidth, 0.004, 0.15]} />
            <meshStandardMaterial
              color={isWhite ? '#ffffff' : '#111111'}
              roughness={0.85}
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-1}
            />
          </mesh>
        );
      })}

      {([-1, 1] as const).map((sign) => (
        <group key={`gate-${sign}`} position={[sign * gateHalfWidth, 0, 0]}>
          <mesh position={[0, ROAD_TOP_Y + 1.4, 0]} castShadow>
            <boxGeometry args={[0.25, 2.8, 0.25]} />
            <meshStandardMaterial
              ref={sign < 0 ? leftPostRef : rightPostRef}
              color={palette.accent}
              emissive={palette.accent}
              emissiveIntensity={0.75}
              roughness={0.5}
            />
          </mesh>
          <mesh position={[0, ROAD_TOP_Y + 3.05, 0]}>
            <sphereGeometry args={[0.28, 12, 12]} />
            <meshStandardMaterial
              ref={sign < 0 ? leftLightRef : rightLightRef}
              color={LIGHT_COLORS.idle}
              emissive={LIGHT_COLORS.idle}
              emissiveIntensity={0.4}
              roughness={0.25}
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

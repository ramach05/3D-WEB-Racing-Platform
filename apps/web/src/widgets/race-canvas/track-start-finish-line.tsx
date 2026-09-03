import type { OrientedBox, TrackPalette } from '@/entities/track';

type TrackStartFinishLineProps = {
  line: OrientedBox;
  roadWidth: number;
  palette: TrackPalette;
};

const CHECKER_COUNT = 10;
const ARROW_DISTANCES = [2, 4, 6] as const;
const ROAD_TOP_Y = 0.1;
const MARKING_Y = ROAD_TOP_Y + 0.002;

/** Шахматная линия старт/финиш и стрелки направления движения */
export const TrackStartFinishLine = ({ line, roadWidth, palette }: TrackStartFinishLineProps) => {
  const segmentWidth = roadWidth / CHECKER_COUNT;
  const gateHalfWidth = roadWidth / 2 + 0.75;

  return (
    <group
      position={[line.position[0], 0, line.position[2]]}
      rotation={[0, line.rotationY, 0]}
    >
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

      {[-1, 1].map((sign) => (
        <mesh key={`post-${sign}`} position={[sign * gateHalfWidth, ROAD_TOP_Y + 1.4, 0]} castShadow>
          <boxGeometry args={[0.25, 2.8, 0.25]} />
          <meshStandardMaterial
            color={palette.accent}
            emissive={palette.accent}
            emissiveIntensity={0.75}
            roughness={0.5}
          />
        </mesh>
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

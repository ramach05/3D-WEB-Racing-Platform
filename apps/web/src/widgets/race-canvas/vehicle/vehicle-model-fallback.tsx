import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { MeshStandardMaterial } from 'three';
import type { TCarSkin } from '@/entities/track';
import { uiPalette } from '@/shared/config';
import { VEHICLE_TARGET_LENGTH } from '@/widgets/race-canvas/vehicle/vehicle-fit';

/** Sega (dark) accents — match --sega-cyan / --sega-magenta */
export const FALLBACK_ACCENT_CYAN = uiPalette.dark['sega-cyan'];
export const FALLBACK_ACCENT_MAGENTA = uiPalette.dark['sega-magenta'];

/** Ghost-car body dimensions (meters) */
export const FALLBACK_BODY = {
  width: VEHICLE_TARGET_LENGTH * 0.48,
  height: 0.32,
  length: VEHICLE_TARGET_LENGTH * 0.88,
  y: 0.42,
} as const;

/** Cabin on top of the body */
export const FALLBACK_CABIN = {
  width: VEHICLE_TARGET_LENGTH * 0.4,
  height: 0.26,
  length: VEHICLE_TARGET_LENGTH * 0.42,
  y: 0.7,
  z: -0.12,
} as const;

/** Wheels: radius, rim thickness, track and wheelbase */
export const FALLBACK_WHEEL = {
  radius: 0.28,
  thickness: 0.1,
  track: VEHICLE_TARGET_LENGTH * 0.42,
  wheelbase: VEHICLE_TARGET_LENGTH * 0.55,
} as const;

/** Wheel center positions [x, y, z] — FL, FR, RL, RR */
export const FALLBACK_WHEEL_POSITIONS: ReadonlyArray<readonly [number, number, number]> = [
  [FALLBACK_WHEEL.track / 2, FALLBACK_WHEEL.radius, FALLBACK_WHEEL.wheelbase / 2],
  [-FALLBACK_WHEEL.track / 2, FALLBACK_WHEEL.radius, FALLBACK_WHEEL.wheelbase / 2],
  [FALLBACK_WHEEL.track / 2, FALLBACK_WHEEL.radius, -FALLBACK_WHEEL.wheelbase / 2],
  [-FALLBACK_WHEEL.track / 2, FALLBACK_WHEEL.radius, -FALLBACK_WHEEL.wheelbase / 2],
];

const FILL_OPACITY = 0.38;
const WIRE_OPACITY = 0.72;
const PULSE_LO = 0.25;
const PULSE_HI = 0.95;
/** Stepped pulse frequency (Hz of half cycle → full ~1 Hz) */
const PULSE_HZ = 2;

type TVehicleModelFallbackProps = {
  carSkin: TCarSkin;
};

/** Low-poly "ghost" car silhouette while the GLB loads. Translucent body + Sega wireframe accents with pulsing emissive. */
export const VehicleModelFallback = ({ carSkin }: TVehicleModelFallbackProps) => {
  const bodyFillRef = useRef<MeshStandardMaterial>(null);
  const bodyWireRef = useRef<MeshStandardMaterial>(null);
  const cabinFillRef = useRef<MeshStandardMaterial>(null);
  const cabinWireRef = useRef<MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const phase = Math.floor(clock.elapsedTime * PULSE_HZ) % 2;
    const intensity = phase === 0 ? PULSE_LO : PULSE_HI;

    if (bodyFillRef.current) {
      bodyFillRef.current.emissiveIntensity = intensity * 0.45;
    }
    if (cabinFillRef.current) {
      cabinFillRef.current.emissiveIntensity = intensity * 0.45;
    }
    if (bodyWireRef.current) {
      bodyWireRef.current.emissiveIntensity = intensity;
    }
    if (cabinWireRef.current) {
      cabinWireRef.current.emissiveIntensity = intensity;
    }
  });

  return (
    <group>
      <mesh position={[0, FALLBACK_BODY.y, 0]} castShadow={false} receiveShadow={false}>
        <boxGeometry args={[FALLBACK_BODY.width, FALLBACK_BODY.height, FALLBACK_BODY.length]} />
        <meshStandardMaterial
          ref={bodyFillRef}
          color={carSkin.body}
          emissive={carSkin.body}
          emissiveIntensity={PULSE_LO * 0.45}
          metalness={0.2}
          roughness={0.55}
          transparent
          opacity={FILL_OPACITY}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, FALLBACK_BODY.y, 0]} castShadow={false} receiveShadow={false}>
        <boxGeometry args={[FALLBACK_BODY.width, FALLBACK_BODY.height, FALLBACK_BODY.length]} />
        <meshStandardMaterial
          ref={bodyWireRef}
          color={FALLBACK_ACCENT_CYAN}
          emissive={FALLBACK_ACCENT_CYAN}
          emissiveIntensity={PULSE_LO}
          metalness={0.1}
          roughness={0.4}
          wireframe
          transparent
          opacity={WIRE_OPACITY}
          depthWrite={false}
        />
      </mesh>

      <mesh
        position={[0, FALLBACK_CABIN.y, FALLBACK_CABIN.z]}
        castShadow={false}
        receiveShadow={false}
      >
        <boxGeometry args={[FALLBACK_CABIN.width, FALLBACK_CABIN.height, FALLBACK_CABIN.length]} />
        <meshStandardMaterial
          ref={cabinFillRef}
          color={carSkin.cabin}
          emissive={FALLBACK_ACCENT_MAGENTA}
          emissiveIntensity={PULSE_LO * 0.45}
          metalness={0.15}
          roughness={0.6}
          transparent
          opacity={FILL_OPACITY}
          depthWrite={false}
        />
      </mesh>
      <mesh
        position={[0, FALLBACK_CABIN.y, FALLBACK_CABIN.z]}
        castShadow={false}
        receiveShadow={false}
      >
        <boxGeometry args={[FALLBACK_CABIN.width, FALLBACK_CABIN.height, FALLBACK_CABIN.length]} />
        <meshStandardMaterial
          ref={cabinWireRef}
          color={FALLBACK_ACCENT_MAGENTA}
          emissive={FALLBACK_ACCENT_MAGENTA}
          emissiveIntensity={PULSE_LO}
          metalness={0.1}
          roughness={0.4}
          wireframe
          transparent
          opacity={WIRE_OPACITY}
          depthWrite={false}
        />
      </mesh>

      {FALLBACK_WHEEL_POSITIONS.map((pos, index) => (
        <group key={index} position={pos}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow={false} receiveShadow={false}>
            <cylinderGeometry
              args={[FALLBACK_WHEEL.radius, FALLBACK_WHEEL.radius, FALLBACK_WHEEL.thickness, 12]}
            />
            <meshStandardMaterial
              color={carSkin.wheel}
              emissive={FALLBACK_ACCENT_CYAN}
              emissiveIntensity={0.35}
              metalness={0.4}
              roughness={0.5}
              transparent
              opacity={FILL_OPACITY + 0.1}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow={false} receiveShadow={false}>
            <cylinderGeometry
              args={[FALLBACK_WHEEL.radius, FALLBACK_WHEEL.radius, FALLBACK_WHEEL.thickness, 12]}
            />
            <meshStandardMaterial
              color={FALLBACK_ACCENT_CYAN}
              emissive={FALLBACK_ACCENT_CYAN}
              emissiveIntensity={0.55}
              metalness={0.1}
              roughness={0.4}
              wireframe
              transparent
              opacity={WIRE_OPACITY}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};

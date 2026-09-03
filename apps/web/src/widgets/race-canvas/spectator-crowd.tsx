import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Matrix4, Object3D, type InstancedMesh } from 'three';
import type { TrackPalette } from '@/entities/track';

export type SpectatorSeat = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  phase: number;
  scaleY: number;
  waves: boolean;
  shirtColor: string;
};

type SpectatorCrowdProps = {
  seats: SpectatorSeat[];
  palette: TrackPalette;
  isNight: boolean;
  paused: boolean;
};

const SHIRT_COLORS_DAY = [
  '#e63946',
  '#1d3557',
  '#2a9d8f',
  '#f4a261',
  '#264653',
  '#8338ec',
  '#ffffff',
  '#ffd60a',
  '#06d6a0',
  '#118ab2',
];

const SHIRT_COLORS_NIGHT = [
  '#ff2bd6',
  '#00e5ff',
  '#ff6b35',
  '#c77dff',
  '#48cae4',
  '#ff006e',
  '#fb5607',
  '#8338ec',
  '#06d6a0',
  '#ffd60a',
];

type BuildSpectatorSeatsOptions = {
  tribuneInnerX: number;
  sideSign: number;
  count: number;
  sectionWidth: number;
};

/** Создаёт места зрителей на секции трибуны (локальные координаты секции) */
export const buildSpectatorSeats = ({
  tribuneInnerX,
  sideSign,
  count,
  sectionWidth,
}: BuildSpectatorSeatsOptions): SpectatorSeat[] => {
  const seats: SpectatorSeat[] = [];
  const rows = 5;
  const rowDepth = 0.75;
  const rowHeight = 0.65;
  const seatSpacing = 0.82;
  const maxCols = Math.max(1, Math.floor(sectionWidth / seatSpacing));
  const cols = Math.min(maxCols, Math.ceil(count / rows));
  const yaw = sideSign > 0 ? Math.PI / 2 : -Math.PI / 2;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (seats.length >= count) {
        break;
      }
      const colOffset = (col - (cols - 1) / 2) * seatSpacing;
      seats.push({
        x: tribuneInnerX + sideSign * (row * rowDepth + rowDepth / 2),
        y: (row + 1) * rowHeight + 0.02,
        z: colOffset,
        yaw,
        phase: Math.random() * Math.PI * 2,
        scaleY: 0.9 + Math.random() * 0.2,
        waves: Math.random() < 0.6,
        shirtColor: '',
      });
    }
  }

  return seats;
};

/** Анимированная толпа зрителей через InstancedMesh */
export const SpectatorCrowd = ({ seats, isNight, paused }: SpectatorCrowdProps) => {
  const bodyRef = useRef<InstancedMesh>(null);
  const headRef = useRef<InstancedMesh>(null);
  const armRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const shoulder = useMemo(() => new Object3D(), []);
  const armLocal = useMemo(() => new Object3D(), []);
  const armMatrix = useMemo(() => new Matrix4(), []);
  const shirtColors = isNight ? SHIRT_COLORS_NIGHT : SHIRT_COLORS_DAY;

  const coloredSeats = useMemo(
    () =>
      seats.map((seat, index) => ({
        ...seat,
        shirtColor: seat.shirtColor || shirtColors[index % shirtColors.length] || '#888888',
      })),
    [seats, shirtColors],
  );

  useLayoutEffect(() => {
    const bodyMesh = bodyRef.current;
    const armMesh = armRef.current;
    if (!bodyMesh || !armMesh) {
      return;
    }

    for (let i = 0; i < coloredSeats.length; i += 1) {
      const seat = coloredSeats[i];
      if (!seat) {
        continue;
      }
      const color = new Color(seat.shirtColor);
      bodyMesh.setColorAt(i, color);
      armMesh.setColorAt(i, color);
    }

    bodyMesh.instanceColor!.needsUpdate = true;
    armMesh.instanceColor!.needsUpdate = true;
  }, [coloredSeats]);

  useFrame((state) => {
    if (coloredSeats.length === 0) {
      return;
    }

    const bodyMesh = bodyRef.current;
    const headMesh = headRef.current;
    const armMesh = armRef.current;
    if (!bodyMesh || !headMesh || !armMesh) {
      return;
    }

    const time = paused ? 0 : state.clock.elapsedTime;

    for (let i = 0; i < coloredSeats.length; i += 1) {
      const seat = coloredSeats[i];
      if (!seat) {
        continue;
      }

      const bob = paused ? 0 : Math.sin(time * 2 + seat.phase) * 0.03;
      const baseY = seat.y + bob;

      dummy.position.set(seat.x, baseY, seat.z);
      dummy.rotation.set(0, seat.yaw, 0);
      dummy.scale.set(1, seat.scaleY, 1);
      dummy.updateMatrix();
      bodyMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(seat.x, baseY + 0.55 * seat.scaleY, seat.z);
      dummy.rotation.set(0, seat.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      headMesh.setMatrixAt(i, dummy.matrix);

      const waveAngle = !paused && seat.waves ? Math.sin(time * 3 + seat.phase) * 0.6 : 0;
      shoulder.position.set(seat.x, baseY + 0.25 * seat.scaleY, seat.z);
      shoulder.rotation.set(0, seat.yaw, 0);
      shoulder.updateMatrix();

      armLocal.position.set(0.22, 0.1, 0);
      armLocal.rotation.set(0, 0, waveAngle);
      armLocal.updateMatrix();
      armMatrix.multiplyMatrices(shoulder.matrix, armLocal.matrix);
      armMesh.setMatrixAt(i, armMatrix);
    }

    bodyMesh.instanceMatrix.needsUpdate = true;
    headMesh.instanceMatrix.needsUpdate = true;
    armMesh.instanceMatrix.needsUpdate = true;
  });

  if (coloredSeats.length === 0) {
    return null;
  }

  return (
    <group>
      <instancedMesh
        ref={bodyRef}
        args={[undefined, undefined, coloredSeats.length]}
        castShadow={!isNight}
      >
        <boxGeometry args={[0.35, 0.7, 0.25]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.75}
          emissive={isNight ? '#ffffff' : '#000000'}
          emissiveIntensity={isNight ? 0.38 : 0}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh
        ref={headRef}
        args={[undefined, undefined, coloredSeats.length]}
        castShadow={!isNight}
      >
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial
          color="#f0d4b8"
          emissive={isNight ? '#e8c4a0' : '#000000'}
          emissiveIntensity={isNight ? 0.35 : 0}
          roughness={0.85}
        />
      </instancedMesh>

      <instancedMesh
        ref={armRef}
        args={[undefined, undefined, coloredSeats.length]}
        castShadow={!isNight}
      >
        <boxGeometry args={[0.12, 0.45, 0.12]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.75}
          emissive={isNight ? '#ffffff' : '#000000'}
          emissiveIntensity={isNight ? 0.32 : 0}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
};

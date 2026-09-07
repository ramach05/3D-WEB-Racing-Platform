import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Color,
  Matrix4,
  Object3D,
  type InstancedMesh,
  type MeshStandardMaterial,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import type { TTrackPalette } from '@/entities/track';
import { getRaceHudSnapshot } from '@/features/race-session';
import { crowdPalette } from '@/shared/config';

export type TSpectatorSeat = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  phase: number;
  leanPhase: number;
  bobSpeed: number;
  waveSpeed: number;
  scaleX: number;
  scaleY: number;
  waves: boolean;
  shirtColor: string;
  skinColor: string;
  pantsColor: string;
};

type TSpectatorCrowdProps = {
  seats: TSpectatorSeat[];
  palette: TTrackPalette;
  isNight: boolean;
  paused: boolean;
};

type TBuildSpectatorSeatsOptions = {
  tribuneInnerX: number;
  sideSign: number;
  count: number;
  sectionWidth: number;
  /** Шаг центров соседних секций — ограничивает рассадку, чтобы стыки не пустели и не пересекались */
  sectionPitch: number;
};

const pick = <T,>(items: readonly T[], index: number): T => items[index % items.length] as T;

/** Создаёт места зрителей на секции трибуны (локальные координаты секции) */
export const buildSpectatorSeats = ({
  tribuneInnerX,
  sideSign,
  count,
  sectionWidth,
  sectionPitch,
}: TBuildSpectatorSeatsOptions): TSpectatorSeat[] => {
  const seats: TSpectatorSeat[] = [];
  const rows = 5;
  const rowDepth = 0.75;
  const rowHeight = 0.65;
  const seatSpacing = 0.92;
  // Крайние места соседних секций оказываются примерно на seatSpacing друг от друга
  const halfSpan = Math.min(sectionWidth / 2 - 0.2, sectionPitch / 2 - seatSpacing / 2);
  const usableWidth = Math.max(seatSpacing, halfSpan * 2);
  const maxCols = Math.max(1, Math.floor(usableWidth / seatSpacing + 0.001) + 1);
  const cols = Math.min(maxCols, Math.ceil(count / rows));
  const yaw = sideSign > 0 ? Math.PI / 2 : -Math.PI / 2;
  const step = cols > 1 ? (halfSpan * 2) / (cols - 1) : 0;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (seats.length >= count) {
        break;
      }
      const colOffset = -halfSpan + col * step;
      seats.push({
        x: tribuneInnerX + sideSign * (row * rowDepth + rowDepth / 2),
        y: (row + 1) * rowHeight + 0.02,
        z: colOffset,
        yaw,
        phase: Math.random() * Math.PI * 2,
        leanPhase: Math.random() * Math.PI * 2,
        bobSpeed: 0.85 + Math.random() * 0.4,
        waveSpeed: 0.8 + Math.random() * 0.5,
        scaleX: 0.92 + Math.random() * 0.12,
        scaleY: 0.92 + Math.random() * 0.14,
        waves: Math.random() < 0.88,
        shirtColor: '',
        skinColor: '',
        pantsColor: '',
      });
    }
  }

  return seats;
};

type TEnergyLevel = {
  bobAmp: number;
  bobSpeed: number;
  waveAmp: number;
  waveSpeed: number;
  leanAmp: number;
};

const ENERGY_IDLE: TEnergyLevel = {
  bobAmp: 0.07,
  bobSpeed: 2.8,
  waveAmp: 0.85,
  waveSpeed: 3.6,
  leanAmp: 0.07,
};

const ENERGY_RACING: TEnergyLevel = {
  bobAmp: 0.1,
  bobSpeed: 4,
  waveAmp: 0.95,
  waveSpeed: 5,
  leanAmp: 0.1,
};

const ENERGY_CHEER: TEnergyLevel = {
  bobAmp: 0.14,
  bobSpeed: 5.8,
  waveAmp: 1.1,
  waveSpeed: 7.2,
  leanAmp: 0.15,
};

const ENERGY_NIGHT_BOOST = 1.12;

const applyInstanceColors = (mesh: InstancedMesh, colors: Color[]): void => {
  for (let i = 0; i < colors.length; i += 1) {
    const color = colors[i];
    if (color) {
      mesh.setColorAt(i, color);
    }
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  const material = mesh.material as MeshStandardMaterial;
  material.needsUpdate = true;
};

/** Подкрашивает emissive цветом инстанса — неон светится своим оттенком */
const enableInstanceEmissiveTint = (material: MeshStandardMaterial): void => {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
#ifdef USE_INSTANCING_COLOR
  totalEmissiveRadiance *= vInstanceColor;
#endif`,
    );
  };
  material.needsUpdate = true;
};

/** Анимированная толпа зрителей через InstancedMesh */
export const SpectatorCrowd = ({ seats, isNight, paused }: TSpectatorCrowdProps) => {
  const bodyRef = useRef<InstancedMesh>(null);
  const headRef = useRef<InstancedMesh>(null);
  const leftArmRef = useRef<InstancedMesh>(null);
  const rightArmRef = useRef<InstancedMesh>(null);
  const legsRef = useRef<InstancedMesh>(null);
  const bodyMatRef = useRef<MeshStandardMaterial>(null);
  const leftArmMatRef = useRef<MeshStandardMaterial>(null);
  const rightArmMatRef = useRef<MeshStandardMaterial>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const shoulder = useMemo(() => new Object3D(), []);
  const armLocal = useMemo(() => new Object3D(), []);
  const armMatrix = useMemo(() => new Matrix4(), []);
  const shirtColors = isNight ? crowdPalette.shirtNight : crowdPalette.shirtDay;
  const pantsColors = isNight ? crowdPalette.pantsNight : crowdPalette.pantsDay;

  const coloredSeats = useMemo(
    () =>
      seats.map((seat, index) => {
        const salt = Math.floor(seat.phase * 17 + index * 3);
        return {
          ...seat,
          shirtColor: seat.shirtColor || pick(shirtColors, salt),
          skinColor: seat.skinColor || pick(crowdPalette.skin, salt + 2),
          pantsColor: seat.pantsColor || pick(pantsColors, salt + 5),
        };
      }),
    [seats, shirtColors, pantsColors],
  );

  useLayoutEffect(() => {
    const bodyMesh = bodyRef.current;
    const leftArmMesh = leftArmRef.current;
    const rightArmMesh = rightArmRef.current;
    const headMesh = headRef.current;
    const legsMesh = legsRef.current;
    if (!bodyMesh || !leftArmMesh || !rightArmMesh || !headMesh || !legsMesh) {
      return;
    }

    const shirts = coloredSeats.map((seat) => new Color(seat.shirtColor));
    const skins = coloredSeats.map((seat) => new Color(seat.skinColor));
    const pants = coloredSeats.map((seat) => new Color(seat.pantsColor));

    applyInstanceColors(bodyMesh, shirts);
    applyInstanceColors(leftArmMesh, shirts);
    applyInstanceColors(rightArmMesh, shirts);
    applyInstanceColors(headMesh, skins);
    applyInstanceColors(legsMesh, pants);

    if (isNight) {
      if (bodyMatRef.current) {
        enableInstanceEmissiveTint(bodyMatRef.current);
      }
      if (leftArmMatRef.current) {
        enableInstanceEmissiveTint(leftArmMatRef.current);
      }
      if (rightArmMatRef.current) {
        enableInstanceEmissiveTint(rightArmMatRef.current);
      }
    }
  }, [coloredSeats, isNight]);

  useFrame((state) => {
    if (coloredSeats.length === 0) {
      return;
    }

    const bodyMesh = bodyRef.current;
    const headMesh = headRef.current;
    const leftArmMesh = leftArmRef.current;
    const rightArmMesh = rightArmRef.current;
    const legsMesh = legsRef.current;
    if (!bodyMesh || !headMesh || !leftArmMesh || !rightArmMesh || !legsMesh) {
      return;
    }

    const time = paused ? 0 : state.clock.elapsedTime;
    const status = getRaceHudSnapshot().status;
    const cheer = status === 'finished';
    const racing = status === 'racing' || status === 'countdown';
    let baseEnergy: TEnergyLevel = ENERGY_IDLE;
    if (cheer) {
      baseEnergy = ENERGY_CHEER;
    } else if (racing) {
      baseEnergy = ENERGY_RACING;
    }
    const nightMul = isNight ? ENERGY_NIGHT_BOOST : 1;
    const energy: TEnergyLevel = {
      bobAmp: baseEnergy.bobAmp * nightMul,
      bobSpeed: baseEnergy.bobSpeed * (isNight ? 1.08 : 1),
      waveAmp: baseEnergy.waveAmp * nightMul,
      waveSpeed: baseEnergy.waveSpeed * (isNight ? 1.1 : 1),
      leanAmp: baseEnergy.leanAmp * nightMul,
    };

    for (let i = 0; i < coloredSeats.length; i += 1) {
      const seat = coloredSeats[i];
      if (!seat) {
        continue;
      }

      const mexicanPhase = seat.z * 1.15;
      const bob = paused
        ? 0
        : Math.sin(time * energy.bobSpeed * seat.bobSpeed + seat.phase + mexicanPhase) *
          energy.bobAmp;
      const lean = paused
        ? 0
        : Math.sin(time * energy.bobSpeed * 0.7 + seat.leanPhase) * energy.leanAmp;
      const baseY = seat.y + bob;
      const torsoY = baseY + 0.28 * seat.scaleY;

      dummy.position.set(seat.x, baseY + 0.08 * seat.scaleY, seat.z);
      dummy.rotation.set(0, seat.yaw, lean * 0.35);
      dummy.scale.set(seat.scaleX, seat.scaleY, 1);
      dummy.updateMatrix();
      legsMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(seat.x, torsoY, seat.z);
      dummy.rotation.set(lean * 0.4, seat.yaw, lean);
      dummy.scale.set(seat.scaleX, seat.scaleY, 1);
      dummy.updateMatrix();
      bodyMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(seat.x, torsoY + 0.42 * seat.scaleY, seat.z);
      dummy.rotation.set(lean * 0.25, seat.yaw, lean * 0.5);
      dummy.scale.set(seat.scaleX, 1, 1);
      dummy.updateMatrix();
      headMesh.setMatrixAt(i, dummy.matrix);

      const shouldWave = !paused && (seat.waves || cheer || racing);
      const waveBase = shouldWave
        ? Math.sin(time * energy.waveSpeed * seat.waveSpeed + seat.phase + mexicanPhase) *
          energy.waveAmp
        : 0;
      const waveSecondary = shouldWave
        ? Math.sin(time * energy.waveSpeed * seat.waveSpeed * 0.85 + seat.phase + 1.2) *
          energy.waveAmp *
          0.4
        : 0;

      shoulder.position.set(seat.x, torsoY + 0.12 * seat.scaleY, seat.z);
      shoulder.rotation.set(lean * 0.3, seat.yaw, lean);
      shoulder.updateMatrix();

      armLocal.position.set(0.2 * seat.scaleX, 0.08, 0);
      armLocal.rotation.set(0, 0, waveBase);
      armLocal.updateMatrix();
      armMatrix.multiplyMatrices(shoulder.matrix, armLocal.matrix);
      rightArmMesh.setMatrixAt(i, armMatrix);

      armLocal.position.set(-0.2 * seat.scaleX, 0.08, 0);
      armLocal.rotation.set(0, 0, -waveSecondary);
      armLocal.updateMatrix();
      armMatrix.multiplyMatrices(shoulder.matrix, armLocal.matrix);
      leftArmMesh.setMatrixAt(i, armMatrix);
    }

    bodyMesh.instanceMatrix.needsUpdate = true;
    headMesh.instanceMatrix.needsUpdate = true;
    leftArmMesh.instanceMatrix.needsUpdate = true;
    rightArmMesh.instanceMatrix.needsUpdate = true;
    legsMesh.instanceMatrix.needsUpdate = true;
  });

  if (coloredSeats.length === 0) {
    return null;
  }

  const count = coloredSeats.length;
  // Слабый цветной glow; toneMapped=true — иначе bloom выжигает футболки в белый
  const shirtEmissiveIntensity = isNight ? 0.22 : 0;
  const armEmissiveIntensity = isNight ? 0.16 : 0;
  const headEmissiveIntensity = isNight ? 0.06 : 0;

  return (
    <group>
      <instancedMesh ref={legsRef} args={[undefined, undefined, count]} castShadow={!isNight}>
        <boxGeometry args={[0.32, 0.14, 0.38]} />
        <meshStandardMaterial color={crowdPalette.meshBase} roughness={0.92} />
      </instancedMesh>

      <instancedMesh ref={bodyRef} args={[undefined, undefined, count]} castShadow={!isNight}>
        <boxGeometry args={[0.3, 0.46, 0.22]} />
        <meshStandardMaterial
          ref={bodyMatRef}
          color={crowdPalette.meshBase}
          roughness={0.72}
          emissive={isNight ? crowdPalette.meshBase : crowdPalette.emissiveOff}
          emissiveIntensity={shirtEmissiveIntensity}
        />
      </instancedMesh>

      <instancedMesh ref={headRef} args={[undefined, undefined, count]} castShadow={!isNight}>
        <sphereGeometry args={[0.15, 10, 10]} />
        <meshStandardMaterial
          color={crowdPalette.meshBase}
          emissive={isNight ? crowdPalette.skinEmissiveNight : crowdPalette.emissiveOff}
          emissiveIntensity={headEmissiveIntensity}
          roughness={0.85}
        />
      </instancedMesh>

      <instancedMesh ref={rightArmRef} args={[undefined, undefined, count]} castShadow={!isNight}>
        <boxGeometry args={[0.1, 0.4, 0.1]} />
        <meshStandardMaterial
          ref={rightArmMatRef}
          color={crowdPalette.meshBase}
          roughness={0.72}
          emissive={isNight ? crowdPalette.meshBase : crowdPalette.emissiveOff}
          emissiveIntensity={armEmissiveIntensity}
        />
      </instancedMesh>

      <instancedMesh ref={leftArmRef} args={[undefined, undefined, count]} castShadow={!isNight}>
        <boxGeometry args={[0.1, 0.4, 0.1]} />
        <meshStandardMaterial
          ref={leftArmMatRef}
          color={crowdPalette.meshBase}
          roughness={0.72}
          emissive={isNight ? crowdPalette.meshBase : crowdPalette.emissiveOff}
          emissiveIntensity={armEmissiveIntensity}
        />
      </instancedMesh>
    </group>
  );
};

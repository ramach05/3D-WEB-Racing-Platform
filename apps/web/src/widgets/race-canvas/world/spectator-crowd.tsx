import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Matrix4,
  Object3D,
  type InstancedMesh,
  type MeshStandardMaterial,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import type { TTrackPalette } from '@/entities/track';
import { SEAT_PLANK_HEIGHT } from '@/entities/track';
import { getRaceHudSnapshot } from '@/features/race-session';
import { crowdPalette } from '@/shared/config';
import type {
  TBuildSpectatorSeatsOptions,
  TSpectatorBehavior,
  TSpectatorSeat,
  TSpectatorWaveSide,
} from './spectator-crowd.types';

type TSpectatorCrowdProps = {
  /** Места зрителей секции */
  seats: TSpectatorSeat[];
  /** Палитра трассы (зарезервировано) */
  palette: TTrackPalette;
  /** Ночной неон футболок */
  isNight: boolean;
  /** Пауза анимации */
  paused: boolean;
};

const ARM_RADIUS = 0.038;
const ARM_LENGTH = 0.3;
const ARM_TOTAL = ARM_LENGTH + ARM_RADIUS * 2;
const ARM_PIVOT_OFFSET = ARM_TOTAL / 2;

const TORSO_RADIUS = 0.11;
const TORSO_LENGTH = 0.28;

/** Берёт элемент массива по модулю индекса */
const pick = <T,>(items: readonly T[], index: number): T => items[index % items.length] as T;

/** Выбирает поведение зрителя по весам ~45/20/15/10/5/5 */
const pickBehavior = (roll: number): TSpectatorBehavior => {
  if (roll < 0.45) {
    return 'watch';
  }
  if (roll < 0.65) {
    return 'lean';
  }
  if (roll < 0.8) {
    return 'waveOne';
  }
  if (roll < 0.9) {
    return 'clap';
  }
  if (roll < 0.95) {
    return 'phone';
  }
  return 'cheer';
};

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
      const behavior = pickBehavior(Math.random());
      const hasCap = Math.random() < 0.35;
      const hasFlag = Math.random() < 0.06;
      const hasHair = !hasCap && Math.random() < 0.55;
      const waveSide: TSpectatorWaveSide = Math.random() < 0.5 ? 'right' : 'left';

      seats.push({
        x: tribuneInnerX + sideSign * (row * rowDepth + rowDepth / 2),
        y: (row + 1) * rowHeight + SEAT_PLANK_HEIGHT + 0.02,
        z: colOffset,
        yaw,
        phase: Math.random() * Math.PI * 2,
        leanPhase: Math.random() * Math.PI * 2,
        bobSpeed: 0.75 + Math.random() * 0.45,
        waveSpeed: 0.7 + Math.random() * 0.55,
        scaleX: 0.82 + Math.random() * 0.28,
        scaleY: 0.8 + Math.random() * 0.32,
        behavior,
        waveSide,
        hasCap,
        hasFlag,
        hasHair,
        shirtColor: '',
        skinColor: '',
        pantsColor: '',
        accentColor: '',
      });
    }
  }

  return seats;
};

type TEnergyLevel = {
  /** Амплитуда покачивания */
  bobAmp: number;
  /** Множитель скорости bob */
  bobSpeed: number;
  /** Амплитуда маха руками */
  waveAmp: number;
  /** Множитель скорости маха */
  waveSpeed: number;
  /** Амплитуда наклона */
  leanAmp: number;
};

const ENERGY_IDLE: TEnergyLevel = {
  bobAmp: 0.016,
  bobSpeed: 1.35,
  waveAmp: 0.28,
  waveSpeed: 2.1,
  leanAmp: 0.032,
};

const ENERGY_RACING: TEnergyLevel = {
  bobAmp: 0.025,
  bobSpeed: 1.75,
  waveAmp: 0.34,
  waveSpeed: 2.7,
  leanAmp: 0.048,
};

const ENERGY_CHEER: TEnergyLevel = {
  bobAmp: 0.04,
  bobSpeed: 2.35,
  waveAmp: 0.48,
  waveSpeed: 3.4,
  leanAmp: 0.07,
};

const ENERGY_NIGHT_BOOST = 1.06;

/** Записывает instanceColor для InstancedMesh */
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

type TArmAngles = {
  /** Подъём руки (локальный X) */
  raise: number;
  /** Взмах в сторону (локальный Z) */
  swing: number;
  /** Вынос вперёд (локальный Y twist / pitch mix) */
  forward: number;
};

const ARM_DOWN: TArmAngles = { raise: 0.15, swing: 0.08, forward: 0.05 };

/** Считает углы рук по поведению зрителя */
const computeArmAngles = ({
  behavior,
  side,
  wave,
  energyWave,
  finishBoost,
}: {
  behavior: TSpectatorBehavior;
  side: 'left' | 'right';
  wave: number;
  energyWave: number;
  finishBoost: boolean;
}): { left: TArmAngles; right: TArmAngles } => {
  const left: TArmAngles = { ...ARM_DOWN, swing: -ARM_DOWN.swing };
  const right: TArmAngles = { ...ARM_DOWN };
  const active = side === 'left' ? left : right;
  const other = side === 'left' ? right : left;
  const sign = side === 'left' ? -1 : 1;

  switch (behavior) {
    case 'watch': {
      if (finishBoost) {
        left.raise = 0.55 + wave * 0.25;
        right.raise = 0.5 + wave * 0.2;
        left.swing = -0.2;
        right.swing = 0.2;
      }
      break;
    }
    case 'lean': {
      left.forward = 0.25;
      right.forward = 0.25;
      left.raise = 0.2;
      right.raise = 0.2;
      if (finishBoost) {
        left.raise = 0.7 + wave * 0.2;
        right.raise = 0.65 + wave * 0.25;
      }
      break;
    }
    case 'waveOne': {
      active.raise = 1.15 + wave * energyWave;
      active.swing = sign * (0.25 + wave * 0.35);
      active.forward = 0.15 + Math.abs(wave) * 0.1;
      other.raise = 0.12;
      other.swing = -sign * 0.06;
      break;
    }
    case 'clap': {
      const clap = Math.abs(wave);
      left.raise = 0.55 + clap * 0.2;
      right.raise = 0.55 + clap * 0.2;
      left.swing = 0.55 - clap * 0.45;
      right.swing = -(0.55 - clap * 0.45);
      left.forward = 0.55;
      right.forward = 0.55;
      break;
    }
    case 'cheer': {
      left.raise = 1.45 + wave * energyWave * 0.45;
      right.raise = 1.4 - wave * energyWave * 0.4;
      left.swing = -0.15 + wave * 0.2;
      right.swing = 0.15 - wave * 0.2;
      left.forward = 0.1;
      right.forward = 0.1;
      break;
    }
    case 'phone': {
      active.raise = 1.05;
      active.swing = sign * 0.35;
      active.forward = 0.55;
      other.raise = 0.12;
      other.swing = -sign * 0.05;
      break;
    }
    default:
      break;
  }

  return { left, right };
};

/** Анимированная толпа зрителей через InstancedMesh */
export const SpectatorCrowd = ({ seats, isNight, paused }: TSpectatorCrowdProps) => {
  const bodyRef = useRef<InstancedMesh>(null);
  const headRef = useRef<InstancedMesh>(null);
  const leftArmRef = useRef<InstancedMesh>(null);
  const rightArmRef = useRef<InstancedMesh>(null);
  const legsRef = useRef<InstancedMesh>(null);
  const capRef = useRef<InstancedMesh>(null);
  const hairRef = useRef<InstancedMesh>(null);
  const flagPoleRef = useRef<InstancedMesh>(null);
  const flagClothRef = useRef<InstancedMesh>(null);
  const bodyMatRef = useRef<MeshStandardMaterial>(null);
  const leftArmMatRef = useRef<MeshStandardMaterial>(null);
  const rightArmMatRef = useRef<MeshStandardMaterial>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const shoulder = useMemo(() => new Object3D(), []);
  const armLocal = useMemo(() => new Object3D(), []);
  const armMatrix = useMemo(() => new Matrix4(), []);
  const armPivot = useMemo(() => new Matrix4().makeTranslation(0, -ARM_PIVOT_OFFSET, 0), []);
  const hideMatrix = useMemo(() => {
    const m = new Matrix4();
    m.makeScale(0, 0, 0);
    return m;
  }, []);

  const armGeometry = useMemo(() => {
    const geo = new CapsuleGeometry(ARM_RADIUS, ARM_LENGTH, 3, 6);
    return geo;
  }, []);

  const torsoGeometry = useMemo(() => new CapsuleGeometry(TORSO_RADIUS, TORSO_LENGTH, 4, 8), []);

  const capGeometry = useMemo(() => {
    const geo = new CylinderGeometry(0.14, 0.15, 0.07, 8);
    geo.translate(0, 0.02, 0.02);
    return geo;
  }, []);

  const shirtColors = isNight ? crowdPalette.shirtNight : crowdPalette.shirtDay;
  const pantsColors = isNight ? crowdPalette.pantsNight : crowdPalette.pantsDay;

  const coloredSeats = useMemo(
    () =>
      seats.map((seat, index) => {
        const salt = Math.floor(seat.phase * 17 + index * 3);
        let accentColor: string = pick(crowdPalette.cap, salt + 7);
        if (seat.hasHair && !seat.hasCap) {
          accentColor = pick(crowdPalette.hair, salt + 9);
        } else if (seat.hasFlag && !seat.hasCap) {
          accentColor = pick(shirtColors, salt + 11);
        }
        return {
          ...seat,
          shirtColor: seat.shirtColor || pick(shirtColors, salt),
          skinColor: seat.skinColor || pick(crowdPalette.skin, salt + 2),
          pantsColor: seat.pantsColor || pick(pantsColors, salt + 5),
          accentColor: seat.accentColor || accentColor,
        };
      }),
    [seats, shirtColors, pantsColors],
  );

  // Красит инстансы и включает emissive-tint ночью.
  useLayoutEffect(() => {
    const bodyMesh = bodyRef.current;
    const leftArmMesh = leftArmRef.current;
    const rightArmMesh = rightArmRef.current;
    const headMesh = headRef.current;
    const legsMesh = legsRef.current;
    const capMesh = capRef.current;
    const hairMesh = hairRef.current;
    const flagPoleMesh = flagPoleRef.current;
    const flagClothMesh = flagClothRef.current;
    if (
      !bodyMesh ||
      !leftArmMesh ||
      !rightArmMesh ||
      !headMesh ||
      !legsMesh ||
      !capMesh ||
      !hairMesh ||
      !flagPoleMesh ||
      !flagClothMesh
    ) {
      return;
    }

    const shirts = coloredSeats.map((seat) => new Color(seat.shirtColor));
    const skins = coloredSeats.map((seat) => new Color(seat.skinColor));
    const pants = coloredSeats.map((seat) => new Color(seat.pantsColor));
    const accents = coloredSeats.map((seat) => new Color(seat.accentColor));
    const poles = coloredSeats.map(() => new Color('#c0c0c0'));

    applyInstanceColors(bodyMesh, shirts);
    applyInstanceColors(leftArmMesh, skins);
    applyInstanceColors(rightArmMesh, skins);
    applyInstanceColors(headMesh, skins);
    applyInstanceColors(legsMesh, pants);
    applyInstanceColors(capMesh, accents);
    applyInstanceColors(hairMesh, accents);
    applyInstanceColors(flagPoleMesh, poles);
    applyInstanceColors(flagClothMesh, accents);

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

  // Анимирует bob/wave/lean зрителей по статусу гонки и behavior.
  useFrame((state) => {
    if (coloredSeats.length === 0) {
      return;
    }

    const bodyMesh = bodyRef.current;
    const headMesh = headRef.current;
    const leftArmMesh = leftArmRef.current;
    const rightArmMesh = rightArmRef.current;
    const legsMesh = legsRef.current;
    const capMesh = capRef.current;
    const hairMesh = hairRef.current;
    const flagPoleMesh = flagPoleRef.current;
    const flagClothMesh = flagClothRef.current;
    if (
      !bodyMesh ||
      !headMesh ||
      !leftArmMesh ||
      !rightArmMesh ||
      !legsMesh ||
      !capMesh ||
      !hairMesh ||
      !flagPoleMesh ||
      !flagClothMesh
    ) {
      return;
    }

    const time = paused ? 0 : state.clock.elapsedTime;
    const status = getRaceHudSnapshot().status;
    const finishBoost = status === 'finished';
    const racing = status === 'racing' || status === 'countdown';
    let baseEnergy: TEnergyLevel = ENERGY_IDLE;
    if (finishBoost) {
      baseEnergy = ENERGY_CHEER;
    } else if (racing) {
      baseEnergy = ENERGY_RACING;
    }
    const nightMul = isNight ? ENERGY_NIGHT_BOOST : 1;
    const energy: TEnergyLevel = {
      bobAmp: baseEnergy.bobAmp * nightMul,
      bobSpeed: baseEnergy.bobSpeed * (isNight ? 1.04 : 1),
      waveAmp: baseEnergy.waveAmp * nightMul,
      waveSpeed: baseEnergy.waveSpeed * (isNight ? 1.05 : 1),
      leanAmp: baseEnergy.leanAmp * nightMul,
    };

    for (let i = 0; i < coloredSeats.length; i += 1) {
      const seat = coloredSeats[i];
      if (!seat) {
        continue;
      }

      const phaseJitter = seat.phase * 0.35;
      const bob = paused
        ? 0
        : Math.sin(time * energy.bobSpeed * seat.bobSpeed + seat.phase) * energy.bobAmp;
      const leanBase = seat.behavior === 'lean' ? 0.12 : seat.behavior === 'watch' ? 0.02 : 0.04;
      const lean = paused
        ? leanBase
        : leanBase + Math.sin(time * energy.bobSpeed * 0.55 + seat.leanPhase) * energy.leanAmp;
      const baseY = seat.y + bob;
      const torsoY = baseY + 0.3 * seat.scaleY;

      dummy.position.set(seat.x, baseY + 0.07 * seat.scaleY, seat.z);
      dummy.rotation.set(0, seat.yaw, lean * 0.25);
      dummy.scale.set(seat.scaleX, seat.scaleY, seat.scaleX * 0.95);
      dummy.updateMatrix();
      legsMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(seat.x, torsoY, seat.z);
      dummy.rotation.set(lean * 0.55, seat.yaw, lean * 0.35);
      dummy.scale.set(seat.scaleX, seat.scaleY, seat.scaleX * 0.9);
      dummy.updateMatrix();
      bodyMesh.setMatrixAt(i, dummy.matrix);

      const headY = torsoY + 0.38 * seat.scaleY;
      dummy.position.set(seat.x, headY, seat.z);
      dummy.rotation.set(lean * 0.2, seat.yaw, lean * 0.2);
      dummy.scale.set(seat.scaleX * 0.95, 1, seat.scaleX * 0.95);
      dummy.updateMatrix();
      headMesh.setMatrixAt(i, dummy.matrix);

      if (seat.hasCap) {
        dummy.position.set(seat.x, headY + 0.12 * seat.scaleY, seat.z);
        dummy.rotation.set(lean * 0.15, seat.yaw, lean * 0.15);
        dummy.scale.set(seat.scaleX, seat.scaleY, seat.scaleX);
        dummy.updateMatrix();
        capMesh.setMatrixAt(i, dummy.matrix);
        hairMesh.setMatrixAt(i, hideMatrix);
      } else if (seat.hasHair) {
        dummy.position.set(seat.x, headY + 0.1 * seat.scaleY, seat.z);
        dummy.rotation.set(0, seat.yaw, 0);
        dummy.scale.set(seat.scaleX * 0.85, seat.scaleY * 0.7, seat.scaleX * 0.9);
        dummy.updateMatrix();
        hairMesh.setMatrixAt(i, dummy.matrix);
        capMesh.setMatrixAt(i, hideMatrix);
      } else {
        capMesh.setMatrixAt(i, hideMatrix);
        hairMesh.setMatrixAt(i, hideMatrix);
      }

      const waveMotion = paused
        ? 0
        : Math.sin(time * energy.waveSpeed * seat.waveSpeed + seat.phase + phaseJitter) *
          energy.waveAmp;

      const arms = computeArmAngles({
        behavior: seat.behavior,
        side: seat.waveSide,
        wave: waveMotion,
        energyWave: 1,
        finishBoost: finishBoost && (seat.behavior === 'watch' || seat.behavior === 'lean'),
      });

      shoulder.position.set(seat.x, torsoY + 0.14 * seat.scaleY, seat.z);
      shoulder.rotation.set(lean * 0.4, seat.yaw, lean * 0.25);
      shoulder.scale.set(1, 1, 1);
      shoulder.updateMatrix();

      armLocal.position.set(0.16 * seat.scaleX, 0.02, 0);
      armLocal.rotation.set(arms.right.raise, arms.right.forward * 0.15, arms.right.swing);
      armLocal.scale.set(seat.scaleX, seat.scaleY, seat.scaleX);
      armLocal.updateMatrix();
      armMatrix.multiplyMatrices(shoulder.matrix, armLocal.matrix);
      armMatrix.multiply(armPivot);
      rightArmMesh.setMatrixAt(i, armMatrix);

      armLocal.position.set(-0.16 * seat.scaleX, 0.02, 0);
      armLocal.rotation.set(arms.left.raise, -arms.left.forward * 0.15, arms.left.swing);
      armLocal.scale.set(seat.scaleX, seat.scaleY, seat.scaleX);
      armLocal.updateMatrix();
      armMatrix.multiplyMatrices(shoulder.matrix, armLocal.matrix);
      armMatrix.multiply(armPivot);
      leftArmMesh.setMatrixAt(i, armMatrix);

      if (seat.hasFlag) {
        const flagSide = seat.waveSide === 'right' ? 1 : -1;
        const flagBob = paused ? 0 : waveMotion * 0.15;
        dummy.position.set(
          seat.x + flagSide * 0.22 * seat.scaleX,
          torsoY + 0.35 * seat.scaleY + flagBob,
          seat.z + 0.05,
        );
        dummy.rotation.set(0.05 + flagBob * 0.4, seat.yaw, flagSide * 0.08);
        dummy.scale.set(1, seat.scaleY, 1);
        dummy.updateMatrix();
        flagPoleMesh.setMatrixAt(i, dummy.matrix);

        dummy.position.set(
          seat.x + flagSide * 0.28 * seat.scaleX,
          torsoY + 0.55 * seat.scaleY + flagBob,
          seat.z + 0.05,
        );
        dummy.rotation.set(0.05 + flagBob * 0.5, seat.yaw, flagSide * (0.1 + flagBob * 0.3));
        dummy.scale.set(seat.scaleX, seat.scaleY, 1);
        dummy.updateMatrix();
        flagClothMesh.setMatrixAt(i, dummy.matrix);
      } else {
        flagPoleMesh.setMatrixAt(i, hideMatrix);
        flagClothMesh.setMatrixAt(i, hideMatrix);
      }
    }

    bodyMesh.instanceMatrix.needsUpdate = true;
    headMesh.instanceMatrix.needsUpdate = true;
    leftArmMesh.instanceMatrix.needsUpdate = true;
    rightArmMesh.instanceMatrix.needsUpdate = true;
    legsMesh.instanceMatrix.needsUpdate = true;
    capMesh.instanceMatrix.needsUpdate = true;
    hairMesh.instanceMatrix.needsUpdate = true;
    flagPoleMesh.instanceMatrix.needsUpdate = true;
    flagClothMesh.instanceMatrix.needsUpdate = true;
  });

  if (coloredSeats.length === 0) {
    return null;
  }

  const count = coloredSeats.length;
  // Слабый цветной glow; toneMapped=true — иначе bloom выжигает футболки в белый
  const shirtEmissiveIntensity = isNight ? 0.22 : 0;
  const armEmissiveIntensity = isNight ? 0.08 : 0;
  const headEmissiveIntensity = isNight ? 0.06 : 0;

  /** Ночью толпа не кастит тени — меньше work в moon/headlight shadow passes */
  const castCrowdShadow = !isNight;

  return (
    <group>
      <instancedMesh ref={legsRef} args={[undefined, undefined, count]} castShadow={castCrowdShadow}>
        <boxGeometry args={[0.28, 0.14, 0.34]} />
        <meshStandardMaterial color={crowdPalette.meshBase} roughness={0.92} />
      </instancedMesh>

      <instancedMesh ref={bodyRef} args={[torsoGeometry, undefined, count]} castShadow={castCrowdShadow}>
        <meshStandardMaterial
          ref={bodyMatRef}
          color={crowdPalette.meshBase}
          roughness={0.72}
          emissive={isNight ? crowdPalette.meshBase : crowdPalette.emissiveOff}
          emissiveIntensity={shirtEmissiveIntensity}
        />
      </instancedMesh>

      <instancedMesh ref={headRef} args={[undefined, undefined, count]} castShadow={castCrowdShadow}>
        <sphereGeometry args={[0.135, 8, 8]} />
        <meshStandardMaterial
          color={crowdPalette.meshBase}
          emissive={isNight ? crowdPalette.skinEmissiveNight : crowdPalette.emissiveOff}
          emissiveIntensity={headEmissiveIntensity}
          roughness={0.85}
        />
      </instancedMesh>

      <instancedMesh ref={rightArmRef} args={[armGeometry, undefined, count]} castShadow={castCrowdShadow}>
        <meshStandardMaterial
          ref={rightArmMatRef}
          color={crowdPalette.meshBase}
          roughness={0.78}
          emissive={isNight ? crowdPalette.meshBase : crowdPalette.emissiveOff}
          emissiveIntensity={armEmissiveIntensity}
        />
      </instancedMesh>

      <instancedMesh ref={leftArmRef} args={[armGeometry, undefined, count]} castShadow={castCrowdShadow}>
        <meshStandardMaterial
          ref={leftArmMatRef}
          color={crowdPalette.meshBase}
          roughness={0.78}
          emissive={isNight ? crowdPalette.meshBase : crowdPalette.emissiveOff}
          emissiveIntensity={armEmissiveIntensity}
        />
      </instancedMesh>

      <instancedMesh ref={capRef} args={[capGeometry, undefined, count]} castShadow={castCrowdShadow}>
        <meshStandardMaterial color={crowdPalette.meshBase} roughness={0.8} />
      </instancedMesh>

      <instancedMesh ref={hairRef} args={[undefined, undefined, count]} castShadow={castCrowdShadow}>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshStandardMaterial color={crowdPalette.meshBase} roughness={0.9} />
      </instancedMesh>

      <instancedMesh ref={flagPoleRef} args={[undefined, undefined, count]} castShadow={castCrowdShadow}>
        <cylinderGeometry args={[0.012, 0.012, 0.55, 5]} />
        <meshStandardMaterial color={crowdPalette.meshBase} roughness={0.55} metalness={0.25} />
      </instancedMesh>

      <instancedMesh ref={flagClothRef} args={[undefined, undefined, count]} castShadow={castCrowdShadow}>
        <boxGeometry args={[0.18, 0.12, 0.02]} />
        <meshStandardMaterial color={crowdPalette.meshBase} roughness={0.85} />
      </instancedMesh>
    </group>
  );
};

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import {
  AdditiveBlending,
  CanvasTexture,
  MeshBasicMaterial,
  NormalBlending,
  SRGBColorSpace,
  type Mesh,
  type Texture,
} from 'three';
import { horizonSunStops, type TRadialColorStop } from '@/shared/config';

/** Угловая скорость медленного дыхания ореола (~0.35 Hz) */
const BREATHE_SPEED = 2.2;
/** Угловая скорость атмосферного мерцания */
const SHIMMER_SPEED = 3.4;
/** Фазовый сдвиг мерцания относительно дыхания */
const SHIMMER_PHASE = 1.1;

const CORONA_SCALE_AMP = 0.06;
const CORONA_OPACITY_AMP = 0.08;
const GLOW_SCALE_AMP = 0.1;
const GLOW_OPACITY_AMP = 0.12;
const GLOW_SHIMMER_SCALE_AMP = 0.03;
const GLOW_SHIMMER_OPACITY_AMP = 0.04;

/** Рисует радиальный градиент в CanvasTexture */
const createRadialGradientTexture = (
  stops: readonly TRadialColorStop[],
  size = 256,
): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2d canvas context unavailable');
  }

  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  for (const { stop, color } of stops) {
    gradient.addColorStop(stop, color);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
};

type TSunLayerProps = {
  /** Текстура слоя */
  map: Texture;
  /** Размер плоскости */
  size: number;
  /** Порядок отрисовки (меньше = дальше) */
  renderOrder: number;
  /** Ref меша для анимации ореола; у статичного ядра не нужен */
  meshRef?: RefObject<Mesh | null>;
  /** Additive для ореола; ядро — Normal, чтобы цвет не выбеливался */
  additive?: boolean;
};

/** Один billboard-слой солнца */
const SunLayer = ({ map, size, renderOrder, meshRef, additive = true }: TSunLayerProps) => (
  <mesh ref={meshRef} renderOrder={renderOrder}>
    <planeGeometry args={[size, size]} />
    <meshBasicMaterial
      map={map}
      transparent
      opacity={1}
      blending={additive ? AdditiveBlending : NormalBlending}
      depthWrite={false}
      fog={false}
      toneMapped={false}
    />
  </mesh>
);

/** Применяет scale и opacity к слою, если материал — MeshBasicMaterial */
const applyLayerPulse = (mesh: Mesh | null, scale: number, opacity: number) => {
  if (!mesh) {
    return;
  }
  mesh.scale.setScalar(scale);
  const material = mesh.material;
  if (material instanceof MeshBasicMaterial) {
    material.opacity = opacity;
  }
};

type THorizonSunProps = {
  /** Мировая позиция солнца */
  position: [number, number, number];
};

/** Солнце на горизонте: billboard с многослойным градиентом */
export const HorizonSun = ({ position }: THorizonSunProps) => {
  const glowRef = useRef<Mesh>(null);
  const coronaRef = useRef<Mesh>(null);

  const textures = useMemo(
    () => ({
      core: createRadialGradientTexture(horizonSunStops.core),
      corona: createRadialGradientTexture(horizonSunStops.corona),
      glow: createRadialGradientTexture(horizonSunStops.glow),
    }),
    [],
  );

  // Освобождает текстуры солнца при размонтировании.
  useEffect(
    () => () => {
      textures.core.dispose();
      textures.corona.dispose();
      textures.glow.dispose();
    },
    [textures],
  );

  // Ядро зафиксировано; мягкое дыхание и мерцание только у ореола (corona/glow).
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const breathe = Math.sin(t * BREATHE_SPEED);
    const shimmer = Math.sin(t * SHIMMER_SPEED + SHIMMER_PHASE);

    applyLayerPulse(
      coronaRef.current,
      1 + breathe * CORONA_SCALE_AMP,
      1 + breathe * CORONA_OPACITY_AMP,
    );
    applyLayerPulse(
      glowRef.current,
      1 + breathe * GLOW_SCALE_AMP + shimmer * GLOW_SHIMMER_SCALE_AMP,
      1 + breathe * GLOW_OPACITY_AMP + shimmer * GLOW_SHIMMER_OPACITY_AMP,
    );
  });

  return (
    <group position={position}>
      <Billboard follow>
        <SunLayer meshRef={glowRef} map={textures.glow} size={36} renderOrder={-3} />
        <SunLayer meshRef={coronaRef} map={textures.corona} size={16} renderOrder={-2} />
        <SunLayer map={textures.core} size={8.5} renderOrder={-1} additive={false} />
      </Billboard>
    </group>
  );
};

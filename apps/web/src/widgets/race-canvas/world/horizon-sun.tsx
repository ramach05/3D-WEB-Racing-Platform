import { useEffect, useMemo } from 'react';
import { Billboard } from '@react-three/drei';
import { AdditiveBlending, CanvasTexture, SRGBColorSpace, type Texture } from 'three';

type TRadialStop = { stop: number; color: string };

const createRadialGradientTexture = (stops: TRadialStop[], size = 256): CanvasTexture => {
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

const SUN_CORE_STOPS: TRadialStop[] = [
  { stop: 0, color: 'rgba(255, 252, 245, 1)' },
  { stop: 0.2, color: 'rgba(255, 238, 170, 0.98)' },
  { stop: 0.45, color: 'rgba(255, 200, 80, 0.75)' },
  { stop: 0.72, color: 'rgba(255, 150, 40, 0.35)' },
  { stop: 1, color: 'rgba(255, 110, 20, 0)' },
];

const SUN_CORONA_STOPS: TRadialStop[] = [
  { stop: 0, color: 'rgba(255, 210, 90, 0.55)' },
  { stop: 0.35, color: 'rgba(255, 160, 50, 0.28)' },
  { stop: 0.7, color: 'rgba(255, 110, 30, 0.1)' },
  { stop: 1, color: 'rgba(255, 80, 10, 0)' },
];

const SUN_GLOW_STOPS: TRadialStop[] = [
  { stop: 0, color: 'rgba(255, 190, 100, 0.18)' },
  { stop: 0.45, color: 'rgba(255, 140, 60, 0.08)' },
  { stop: 1, color: 'rgba(255, 100, 40, 0)' },
];

type TSunLayerProps = {
  map: Texture;
  size: number;
  renderOrder: number;
};

const SunLayer = ({ map, size, renderOrder }: TSunLayerProps) => (
  <mesh renderOrder={renderOrder}>
    <planeGeometry args={[size, size]} />
    <meshBasicMaterial
      map={map}
      transparent
      opacity={1}
      blending={AdditiveBlending}
      depthWrite={false}
      fog={false}
      toneMapped={false}
    />
  </mesh>
);

type THorizonSunProps = {
  position: [number, number, number];
};

/** Солнце на горизонте: billboard с многослойным градиентом */
export const HorizonSun = ({ position }: THorizonSunProps) => {
  const textures = useMemo(
    () => ({
      core: createRadialGradientTexture(SUN_CORE_STOPS),
      corona: createRadialGradientTexture(SUN_CORONA_STOPS),
      glow: createRadialGradientTexture(SUN_GLOW_STOPS),
    }),
    [],
  );

  useEffect(
    () => () => {
      textures.core.dispose();
      textures.corona.dispose();
      textures.glow.dispose();
    },
    [textures],
  );

  return (
    <group position={position}>
      <Billboard follow>
        <SunLayer map={textures.glow} size={48} renderOrder={-3} />
        <SunLayer map={textures.corona} size={24} renderOrder={-2} />
        <SunLayer map={textures.core} size={11} renderOrder={-1} />
      </Billboard>
    </group>
  );
};

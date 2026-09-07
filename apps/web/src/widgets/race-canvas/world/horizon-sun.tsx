import { useEffect, useMemo } from 'react';
import { Billboard } from '@react-three/drei';
import { AdditiveBlending, CanvasTexture, SRGBColorSpace, type Texture } from 'three';
import { horizonSunStops, type TRadialColorStop } from '@/shared/config';

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
      core: createRadialGradientTexture(horizonSunStops.core),
      corona: createRadialGradientTexture(horizonSunStops.corona),
      glow: createRadialGradientTexture(horizonSunStops.glow),
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

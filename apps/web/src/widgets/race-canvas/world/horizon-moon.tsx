import { useEffect, useMemo } from 'react';
import { Billboard } from '@react-three/drei';
import {
  AdditiveBlending,
  CanvasTexture,
  NormalBlending,
  SRGBColorSpace,
  type Texture,
} from 'three';

type RadialStop = { stop: number; color: string };

const createRadialGradientTexture = (stops: RadialStop[], size = 256): CanvasTexture => {
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

type MoonPatch = { x: number; y: number; r: number; shade: number };

/** Фиксированные «моря» и кратеры — стабильный вид при каждом рендере */
const MOON_MARIA: MoonPatch[] = [
  { x: 0.38, y: 0.42, r: 0.18, shade: 0.22 },
  { x: 0.58, y: 0.55, r: 0.14, shade: 0.18 },
  { x: 0.48, y: 0.68, r: 0.1, shade: 0.15 },
  { x: 0.32, y: 0.58, r: 0.09, shade: 0.12 },
];

const MOON_CRATERS: MoonPatch[] = [
  { x: 0.44, y: 0.34, r: 0.035, shade: 0.28 },
  { x: 0.62, y: 0.38, r: 0.025, shade: 0.24 },
  { x: 0.52, y: 0.48, r: 0.02, shade: 0.2 },
  { x: 0.36, y: 0.46, r: 0.028, shade: 0.22 },
  { x: 0.55, y: 0.62, r: 0.022, shade: 0.18 },
  { x: 0.42, y: 0.72, r: 0.018, shade: 0.16 },
];

const createMoonDiskTexture = (size = 256): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2d canvas context unavailable');
  }

  const center = size / 2;
  const radius = size * 0.46;

  ctx.clearRect(0, 0, size, size);

  const disk = ctx.createRadialGradient(center, center, radius * 0.1, center, center, radius);
  disk.addColorStop(0, 'rgba(248, 246, 238, 1)');
  disk.addColorStop(0.55, 'rgba(220, 218, 208, 0.98)');
  disk.addColorStop(0.82, 'rgba(185, 188, 198, 0.85)');
  disk.addColorStop(1, 'rgba(140, 148, 168, 0)');

  ctx.fillStyle = disk;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();

  const drawPatch = (patch: MoonPatch, alpha: number) => {
    const x = patch.x * size;
    const y = patch.y * size;
    const r = patch.r * size;
    const shade = Math.round(200 - patch.shade * 120);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, `rgba(${shade}, ${shade + 4}, ${shade + 12}, ${alpha})`);
    gradient.addColorStop(1, `rgba(${shade}, ${shade + 4}, ${shade + 12}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  for (const maria of MOON_MARIA) {
    drawPatch(maria, 0.55);
  }
  for (const crater of MOON_CRATERS) {
    drawPatch(crater, 0.7);
  }

  const limb = ctx.createRadialGradient(center, center, radius * 0.72, center, center, radius);
  limb.addColorStop(0, 'rgba(0, 0, 0, 0)');
  limb.addColorStop(1, 'rgba(40, 50, 80, 0.22)');
  ctx.fillStyle = limb;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
};

const MOON_GLOW_STOPS: RadialStop[] = [
  { stop: 0, color: 'rgba(210, 220, 245, 0.22)' },
  { stop: 0.4, color: 'rgba(170, 185, 220, 0.1)' },
  { stop: 1, color: 'rgba(120, 140, 190, 0)' },
];

const MOON_HALO_STOPS: RadialStop[] = [
  { stop: 0, color: 'rgba(230, 235, 250, 0.12)' },
  { stop: 0.55, color: 'rgba(180, 195, 230, 0.05)' },
  { stop: 1, color: 'rgba(140, 160, 210, 0)' },
];

type MoonLayerProps = {
  map: Texture;
  size: number;
  renderOrder: number;
  additive?: boolean;
};

const MoonLayer = ({ map, size, renderOrder, additive = true }: MoonLayerProps) => (
  <mesh renderOrder={renderOrder}>
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

type HorizonMoonProps = {
  position: [number, number, number];
};

/** Луна на горизонте: billboard с кратерами и мягким лунным свечением */
export const HorizonMoon = ({ position }: HorizonMoonProps) => {
  const textures = useMemo(
    () => ({
      disk: createMoonDiskTexture(),
      halo: createRadialGradientTexture(MOON_HALO_STOPS),
      glow: createRadialGradientTexture(MOON_GLOW_STOPS),
    }),
    [],
  );

  useEffect(
    () => () => {
      textures.disk.dispose();
      textures.halo.dispose();
      textures.glow.dispose();
    },
    [textures],
  );

  return (
    <group position={position}>
      <Billboard follow>
        <MoonLayer map={textures.glow} size={34} renderOrder={-3} />
        <MoonLayer map={textures.halo} size={16} renderOrder={-2} />
        <MoonLayer map={textures.disk} size={9} renderOrder={-1} additive={false} />
      </Billboard>
    </group>
  );
};

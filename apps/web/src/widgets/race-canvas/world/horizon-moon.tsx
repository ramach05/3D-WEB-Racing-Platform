import { useEffect, useMemo } from 'react';
import { Billboard } from '@react-three/drei';
import {
  AdditiveBlending,
  CanvasTexture,
  NormalBlending,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { horizonMoonStops, type TRadialColorStop } from '@/shared/config';

/** Draws a radial gradient into a CanvasTexture */
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

type TMoonPatch = {
  /** Normalized X on the disk */
  x: number;
  /** Normalized Y on the disk */
  y: number;
  /** Patch radius (size fraction) */
  r: number;
  /** Darkening 0..1 */
  shade: number;
};

/** Fixed maria and craters — stable look on every render */
const MOON_MARIA: TMoonPatch[] = [
  { x: 0.38, y: 0.42, r: 0.18, shade: 0.22 },
  { x: 0.58, y: 0.55, r: 0.14, shade: 0.18 },
  { x: 0.48, y: 0.68, r: 0.1, shade: 0.15 },
  { x: 0.32, y: 0.58, r: 0.09, shade: 0.12 },
];

const MOON_CRATERS: TMoonPatch[] = [
  { x: 0.44, y: 0.34, r: 0.035, shade: 0.28 },
  { x: 0.62, y: 0.38, r: 0.025, shade: 0.24 },
  { x: 0.52, y: 0.48, r: 0.02, shade: 0.2 },
  { x: 0.36, y: 0.46, r: 0.028, shade: 0.22 },
  { x: 0.55, y: 0.62, r: 0.022, shade: 0.18 },
  { x: 0.42, y: 0.72, r: 0.018, shade: 0.16 },
];

/** Draws the moon disk with maria and craters */
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
  for (const { stop, color } of horizonMoonStops.disk) {
    disk.addColorStop(stop, color);
  }

  ctx.fillStyle = disk;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();

  /** Draws a patch/crater on the moon disk */
  const drawPatch = (patch: TMoonPatch, alpha: number) => {
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
  for (const { stop, color } of horizonMoonStops.limb) {
    limb.addColorStop(stop, color);
  }
  ctx.fillStyle = limb;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
};

type TMoonLayerProps = {
  /** Layer texture */
  map: Texture;
  /** Plane size */
  size: number;
  /** Draw order */
  renderOrder: number;
  /** Additive blending (glow) */
  additive?: boolean;
};

/** One moon billboard layer */
const MoonLayer = ({ map, size, renderOrder, additive = true }: TMoonLayerProps) => (
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

type THorizonMoonProps = {
  /** Moon world position */
  position: [number, number, number];
};

/** Horizon moon: billboard with craters and soft lunar glow */
export const HorizonMoon = ({ position }: THorizonMoonProps) => {
  const textures = useMemo(
    () => ({
      disk: createMoonDiskTexture(),
      halo: createRadialGradientTexture(horizonMoonStops.halo, 512),
      glow: createRadialGradientTexture(horizonMoonStops.glow, 512),
    }),
    [],
  );

  // Disposes moon textures on unmount.
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

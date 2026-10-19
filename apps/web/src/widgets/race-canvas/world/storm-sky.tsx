import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BackSide, MeshBasicMaterial, type Mesh } from 'three';
import { getSharedStormCloudTexture } from '@/widgets/race-canvas/lib/storm-clouds';

/** Dome radius is below camera.far (500) — dome always stays in frustum */
const DOME_RADIUS = 420;

type TStormSkyProps = {
  /** Cloud tint color (palette.sky) */
  color: string;
  /** Cloud UV scroll speed per second */
  drift?: number;
};

/** Dark overcast storm sky: dome with tiling cloud texture. Follows the camera (radius < far), unlit (basic), fog-excluded. */
export const StormSky = ({ color, drift = 0.004 }: TStormSkyProps) => {
  const texture = useMemo(() => getSharedStormCloudTexture(512), []);
  const meshRef = useRef<Mesh>(null);
  const { camera } = useThree();

  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        map: texture,
        color,
        side: BackSide,
        fog: false,
        depthWrite: false,
        toneMapped: false,
      }),
    [texture, color],
  );

  // Dome is centered on the camera; clouds drift via slow dome rotation.
  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (mesh) {
      mesh.position.copy(camera.position);
      mesh.rotation.y += drift * delta;
    }
  });

  // No texture dispose: it is a singleton; material is released on unmount.
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh ref={meshRef} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[DOME_RADIUS, 32, 16]} />
    </mesh>
  );
};

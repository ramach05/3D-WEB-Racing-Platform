import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BackSide, MeshBasicMaterial, type Mesh } from 'three';
import { getSharedStormCloudTexture } from '@/widgets/race-canvas/lib/storm-clouds';

/** Радиус купола меньше camera.far (500) — купол всегда в frustum */
const DOME_RADIUS = 420;

type TStormSkyProps = {
  /** Цвет тонировки облаков (palette.sky) */
  color: string;
  /** Скорость прокрутки облаков по UV/сек */
  drift?: number;
};

/** Темное облачное пасмурное небо шторма: купол с тайловой текстурой облаков. Следует за камерой (радиус < far), не засвечен (basic), вне тумана. */
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

  // Купол центрируется на камере; дрейф облаков — медленным поворотом купола.
  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (mesh) {
      mesh.position.copy(camera.position);
      mesh.rotation.y += drift * delta;
    }
  });

  // Не dispose: текстура — синглтон, материал освобождаем при unmount.
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh ref={meshRef} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[DOME_RADIUS, 32, 16]} />
    </mesh>
  );
};

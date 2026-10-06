import { useFrame, useThree } from '@react-three/fiber';
import { Matrix4, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { useRef } from 'react';

const RAIN_COUNT = 6000;
const RAIN_HEIGHT = 32;
const RAIN_RADIUS = 24;

const dummy = new Matrix4();
const offsets = new Float32Array(RAIN_COUNT);
for (let i = 0; i < RAIN_COUNT; i += 1) {
  offsets[i] = Math.random() * RAIN_HEIGHT;
}

const tmpCamPos = new Vector3();

/** Система дождевых частиц: куб следует за камерой, наклон от ветра */
export const RainSystem = ({ paused }: { paused: boolean }) => {
  const meshRef = useRef<InstancedMesh>(null);
  const pausedRef = useRef(paused);
  const { camera } = useThree();
  const windX = useRef(0);
  const windZ = useRef(0);

  useFrame(() => {
    if (pausedRef.current !== paused) {
      pausedRef.current = paused;
    }
    if (paused) return;
    const mesh = meshRef.current;
    if (!mesh) return;

    // Копируем позицию камеры (дождь следует за видимой областью)
    camera.getWorldPosition(tmpCamPos);
    const camX = tmpCamPos.x;
    const camZ = tmpCamPos.z;

    // Ветер медленно дрейфует
    windX.current += 0.002;
    windZ.current += 0.003;
    const wX = Math.sin(windX.current * 0.3) * 2;
    const wZ = Math.cos(windZ.current * 0.2) * 1.5;

    for (let i = 0; i < RAIN_COUNT; i += 1) {
      const v = offsets[i]!;
      const nv = v - 22 * (1 / 60);
      const y = nv < -2 ? v + RAIN_HEIGHT : nv;
      offsets[i] = y;
      const x = Math.sin(i * 73.7 + y * 0.08) * RAIN_RADIUS + camX + wX;
      const z = Math.cos(i * 191.3 + y * 0.04) * RAIN_RADIUS + camZ + wZ;
      dummy.setPosition(x, y - RAIN_HEIGHT / 2, z);
      dummy.makeScale(0.012, 0.35 + y * 0.006, 0.012);
      mesh.setMatrixAt(i, dummy);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, RAIN_COUNT]}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        color="#b0b8c4"
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </instancedMesh>
  );
};

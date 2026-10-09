import { useFrame, useThree } from '@react-three/fiber';
import { Matrix4, DoubleSide, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { useRef } from 'react';

const RAIN_COUNT = 9000;
const RAIN_HEIGHT = 42;
const RAIN_RADIUS = 26;
/** Скорость падения (м/сек) — ливень */
const RAIN_FALL_SPEED = 48;

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
    windX.current += 0.004;
    windZ.current += 0.005;
    const wX = Math.sin(windX.current * 0.3) * 3.2;
    const wZ = Math.cos(windZ.current * 0.2) * 2.4;

    for (let i = 0; i < RAIN_COUNT; i += 1) {
      const v = offsets[i]!;
      const nv = v - RAIN_FALL_SPEED * (1 / 60);
      const y = nv < -2 ? v + RAIN_HEIGHT : nv;
      offsets[i] = y;
      const x = Math.sin(i * 73.7 + y * 0.08) * RAIN_RADIUS + camX + wX;
      const z = Math.cos(i * 191.3 + y * 0.04) * RAIN_RADIUS + camZ + wZ;
      dummy.setPosition(x, y - RAIN_HEIGHT / 2, z);
      dummy.makeScale(0.02, 0.5 + y * 0.012, 0.02);
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
        color="#c8d0dc"
        transparent
        opacity={0.5}
        depthWrite={false}
        side={DoubleSide}
      />
    </instancedMesh>
  );
};

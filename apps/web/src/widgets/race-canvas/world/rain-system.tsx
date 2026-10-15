import { useFrame, useThree } from '@react-three/fiber';
import { DoubleSide, Matrix4, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { useRef } from 'react';
import { getRaceHudSnapshot } from '@/features/race-session';

const RAIN_COUNT = 5000;
const RAIN_HEIGHT = 42;
const RAIN_RADIUS = 26;
/** Скорость падения (м/сек) — ливень */
const RAIN_FALL_SPEED = 48;

const offsets = new Float32Array(RAIN_COUNT);
for (let i = 0; i < RAIN_COUNT; i += 1) {
  offsets[i] = Math.random() * RAIN_HEIGHT;
}

const tmpCamPos = new Vector3();
const tmpRot = new Matrix4();

/** Система дождевых частиц: куб следует за камерой, наклон от ветра */
export const RainSystem = () => {
  const meshRef = useRef<InstancedMesh>(null);
  const { camera } = useThree();
  const windX = useRef(0);
  const windZ = useRef(0);

  useFrame(() => {
    // Пауза только в меню-pause; на countdown/finished дождь продолжает идти.
    if (getRaceHudSnapshot().status === 'paused') return;
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

    // Billboard: все плоскости разворачиваются к камере общим поворотом, иначе
    // квады стоят в мире XY и при взгляде вдоль оси Z превращаются в невидимую кромку
    tmpRot.extractRotation(camera.matrixWorld);
    const r = tmpRot.elements;
    const array = mesh.instanceMatrix.array as Float32Array;
    const half = RAIN_HEIGHT / 2;
    const fallStep = RAIN_FALL_SPEED / 60;
    for (let i = 0; i < RAIN_COUNT; i += 1) {
      const v = offsets[i]!;
      const nv = v - fallStep;
      const y = nv < -2 ? v + RAIN_HEIGHT : nv;
      offsets[i] = y;
      const x = Math.sin(i * 73.7 + y * 0.08) * RAIN_RADIUS + camX + wX;
      const z = Math.cos(i * 191.3 + y * 0.04) * RAIN_RADIUS + camZ + wZ;
      const sx = 0.02;
      const sy = 0.5 + y * 0.012;
      const o = i * 16;
      // M = T * R * S: столбцы матрицы = столбцы поворота, умноженные на scale
      array[o] = r[0]! * sx;
      array[o + 1] = r[1]! * sx;
      array[o + 2] = r[2]! * sx;
      array[o + 3] = 0;
      array[o + 4] = r[4]! * sy;
      array[o + 5] = r[5]! * sy;
      array[o + 6] = r[6]! * sy;
      array[o + 7] = 0;
      array[o + 8] = r[8]! * sx;
      array[o + 9] = r[9]! * sx;
      array[o + 10] = r[10]! * sx;
      array[o + 11] = 0;
      array[o + 12] = x;
      array[o + 13] = y - half;
      array[o + 14] = z;
      array[o + 15] = 1;
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, RAIN_COUNT]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        color="#c8d0dc"
        transparent
        opacity={0.4}
        depthWrite={false}
        side={DoubleSide}
      />
    </instancedMesh>
  );
};

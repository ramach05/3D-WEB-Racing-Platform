import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DynamicDrawUsage, type InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { scenePalette } from '@/shared/config';
import { ROAD_TOP_Y } from '@/widgets/race-canvas/lib/road-ribbon-geometry';
import {
  getSkidMarksSnapshot,
  resetSkidMarks,
  SKID_MARK_CAPACITY,
  SKID_SMOKE_CAPACITY,
  skidSegmentOpacity,
  skidSmokeProgress,
  tickSkidMarks,
} from '@/widgets/race-canvas/lib/skid-marks-store';

const MARKING_Y = ROAD_TOP_Y + 0.002;
const SMOKE_COLOR = '#9a9a9c';
const tmpMatrix = new Matrix4();
const tmpPosition = new Vector3();
const tmpScale = new Vector3();
const tmpQuat = new Quaternion();
const tmpFlat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const tmpYaw = new Quaternion();
const tmpColor = new Color();
const Y_AXIS = new Vector3(0, 1, 0);

/** Следы резины на асфальте + короткий дым при жёстком торможении */
export const SkidMarks = () => {
  const marksRef = useRef<InstancedMesh>(null);
  const smokeRef = useRef<InstancedMesh>(null);
  const skidColor = useMemo(() => new Color(scenePalette.skidMark), []);

  useLayoutEffect(() => {
    const marks = marksRef.current;
    const smoke = smokeRef.current;
    if (marks) {
      marks.instanceMatrix.setUsage(DynamicDrawUsage);
      marks.frustumCulled = false;
    }
    if (smoke) {
      smoke.instanceMatrix.setUsage(DynamicDrawUsage);
      smoke.frustumCulled = false;
    }
  }, []);

  useEffect(() => {
    return () => {
      resetSkidMarks();
    };
  }, []);

  useFrame((_, dt) => {
    tickSkidMarks(Math.min(dt, 1 / 20));
    const { segments, smoke } = getSkidMarksSnapshot();

    const marksMesh = marksRef.current;
    if (marksMesh) {
      for (let i = 0; i < SKID_MARK_CAPACITY; i += 1) {
        const segment = segments[i]!;
        const opacity = skidSegmentOpacity(segment);
        if (opacity <= 0.01) {
          tmpScale.set(0, 0, 0);
          tmpMatrix.compose(tmpPosition.set(0, -10, 0), tmpQuat.identity(), tmpScale);
          marksMesh.setMatrixAt(i, tmpMatrix);
          marksMesh.setColorAt(i, tmpColor.setRGB(0, 0, 0));
          continue;
        }

        tmpYaw.setFromAxisAngle(Y_AXIS, segment.yaw);
        tmpQuat.copy(tmpYaw).multiply(tmpFlat);
        tmpPosition.set(segment.x, MARKING_Y, segment.z);
        // После flatten: local X = ширина, local Y = длина вдоль yaw
        tmpScale.set(segment.width, segment.length, 1);
        tmpMatrix.compose(tmpPosition, tmpQuat, tmpScale);
        marksMesh.setMatrixAt(i, tmpMatrix);
        marksMesh.setColorAt(i, tmpColor.copy(skidColor).multiplyScalar(0.35 + opacity * 0.65));
      }
      marksMesh.instanceMatrix.needsUpdate = true;
      if (marksMesh.instanceColor) {
        marksMesh.instanceColor.needsUpdate = true;
      }
    }

    const smokeMesh = smokeRef.current;
    if (smokeMesh) {
      for (let i = 0; i < SKID_SMOKE_CAPACITY; i += 1) {
        const particle = smoke[i]!;
        const progress = skidSmokeProgress(particle);
        if (!particle.alive || progress >= 1) {
          tmpScale.set(0, 0, 0);
          tmpMatrix.compose(tmpPosition.set(0, -10, 0), tmpQuat.identity(), tmpScale);
          smokeMesh.setMatrixAt(i, tmpMatrix);
          continue;
        }

        const rise = progress * 0.55;
        const grow = particle.size * (0.7 + progress * 1.8);
        const shrink = progress > 0.55 ? 1 - (progress - 0.55) / 0.45 : 1;
        tmpPosition.set(particle.x, particle.y + rise, particle.z);
        tmpQuat.identity();
        tmpScale.setScalar(grow * Math.max(0, shrink));
        tmpMatrix.compose(tmpPosition, tmpQuat, tmpScale);
        smokeMesh.setMatrixAt(i, tmpMatrix);
      }
      smokeMesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={marksRef} args={[undefined, undefined, SKID_MARK_CAPACITY]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          transparent
          opacity={0.72}
          depthWrite={false}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </instancedMesh>
      <instancedMesh ref={smokeRef} args={[undefined, undefined, SKID_SMOKE_CAPACITY]}>
        <sphereGeometry args={[0.5, 6, 6]} />
        <meshBasicMaterial
          color={SMOKE_COLOR}
          transparent
          depthWrite={false}
          toneMapped={false}
          opacity={0.32}
        />
      </instancedMesh>
    </>
  );
};

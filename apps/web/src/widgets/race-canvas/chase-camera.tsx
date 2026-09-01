import type { RefObject } from 'react';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RapierRigidBody } from '@react-three/rapier';
import { Quaternion, Vector3 } from 'three';

type ChaseCameraProps = {
  target: RefObject<RapierRigidBody | null>;
};

const desired = new Vector3();
const look = new Vector3();
const offset = new Vector3();
const quat = new Quaternion();

/** Камера сзади машины с плавным lerp */
export const ChaseCamera = ({ target }: ChaseCameraProps) => {
  const ready = useRef(false);

  useFrame((state, dt) => {
    const body = target.current;
    if (!body) {
      return;
    }
    const translation = body.translation();
    const rotation = body.rotation();
    quat.set(rotation.x, rotation.y, rotation.z, rotation.w);
    offset.set(0, 5.5, 12).applyQuaternion(quat);
    desired.set(translation.x, translation.y, translation.z).add(offset);
    look.set(translation.x, translation.y + 1.1, translation.z);
    const alpha = 1 - Math.pow(0.001, dt);
    if (!ready.current) {
      state.camera.position.copy(desired);
      ready.current = true;
    } else {
      state.camera.position.lerp(desired, alpha);
    }
    state.camera.lookAt(look);
  });

  return null;
};

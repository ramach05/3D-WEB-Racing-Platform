import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RapierRigidBody } from '@react-three/rapier';
import { AdditiveBlending, Color, IcosahedronGeometry, Matrix4, Quaternion, Vector3 } from 'three';
import type { InstancedMesh } from 'three';

/** Wheel-spray particle budget (instances) — kept low for FPS */
const SPRAY_COUNT = 120;
const GRAVITY = 9.81;
/** Rear wheels (local): car nose is +Z, rear wheels at -Z */
const REAR_WHEELS: readonly [number, number, number][] = [
  [-0.72, 0.12, -1.05],
  [0.72, 0.12, -1.05],
];
/** m/s threshold, below it there is no spray */
const MIN_SPRAY_SPEED = 4;
/** Particles per second per 1 m/s of speed */
const RATE_PER_MS = 3;

const tmpPos = new Vector3();
const tmpQuat = new Quaternion();
const tmpForward = new Vector3();
const tmpRight = new Vector3();
const dummy = new Matrix4();
const tmpColor = new Color();

type TParticle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  active: boolean;
};

const makePool = (): TParticle[] =>
  Array.from({ length: SPRAY_COUNT }, () => ({
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 0,
    life: 1,
    size: 1,
    active: false,
  }));

type TWheelSprayProps = {
  /** Physical car body — source of position/velocity */
  bodyRef: RefObject<RapierRigidBody | null>;
  /** Show only on rainy tracks */
  enabled: boolean;
};

/**
 * Water spray behind the rear wheels: speed-dependent emission,
 * rearward-upward jet + water mist, short life, additive fade.
 * Instance pool without per-frame allocations; mesh hidden outside rain/at standstill.
 */
export const WheelSpray = ({ bodyRef, enabled }: TWheelSprayProps) => {
  const meshRef = useRef<InstancedMesh>(null);
  const poolRef = useRef<TParticle[]>(makePool());
  const cursor = useRef(0);
  const emitAcc = useRef(0);
  const geometry = useMemo(() => new IcosahedronGeometry(1, 0), []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_state, rawDt) => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }
    const pool = poolRef.current;
    const body = bodyRef.current;
    if (!enabled || !body) {
      mesh.visible = false;
      return;
    }

    const dt = Math.min(rawDt, 1 / 30);
    const t = body.translation();
    const lv = body.linvel();
    const speed = Math.hypot(lv.x, lv.z);
    const q = body.rotation();
    tmpQuat.set(q.x, q.y, q.z, q.w);
    tmpForward.set(0, 0, 1).applyQuaternion(tmpQuat);
    tmpRight.set(1, 0, 0).applyQuaternion(tmpQuat);

    const spraying = speed > MIN_SPRAY_SPEED;
    mesh.visible = spraying || pool.some((p) => p.active);

    if (spraying) {
      emitAcc.current += dt * Math.min(90, speed * RATE_PER_MS);
      while (emitAcc.current >= 1) {
        emitAcc.current -= 1;
        const wheel = REAR_WHEELS[cursor.current % 2];
        cursor.current += 1;
        if (!wheel) {
          continue;
        }
        const idx = cursor.current % SPRAY_COUNT;
        const p = pool[idx];
        if (!p) {
          continue;
        }
        tmpPos.set(wheel[0], wheel[1], wheel[2]).applyQuaternion(tmpQuat).add(t);
        const kick = speed * (0.12 + Math.random() * 0.15);
        const lateral = (Math.random() - 0.5) * 1.2;
        p.x = tmpPos.x;
        p.y = tmpPos.y;
        p.z = tmpPos.z;
        p.vx = -tmpForward.x * kick + tmpRight.x * lateral;
        p.vy = 0.8 + Math.random() * 1.2;
        p.vz = -tmpForward.z * kick + tmpRight.z * lateral;
        p.age = 0;
        p.life = 0.18 + Math.random() * 0.15;
        p.size = 0.035 + Math.random() * 0.05;
        p.active = true;
      }
    } else {
      emitAcc.current = 0;
    }

    for (let i = 0; i < SPRAY_COUNT; i += 1) {
      const p = pool[i];
      if (!p) {
        continue;
      }
      if (!p.active) {
        dummy.makeScale(0, 0, 0);
        mesh.setMatrixAt(i, dummy);
        mesh.setColorAt(i, tmpColor.setScalar(0));
        continue;
      }
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        dummy.makeScale(0, 0, 0);
        mesh.setMatrixAt(i, dummy);
        mesh.setColorAt(i, tmpColor.setScalar(0));
        continue;
      }
      p.vy -= GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const k = p.age / p.life;
      const grow = p.size * (1 + k * 0.4);
      dummy.makeScale(grow, grow, grow);
      dummy.setPosition(p.x, p.y, p.z);
      mesh.setMatrixAt(i, dummy);
      // Brightness fade (additive → transparency)
      mesh.setColorAt(i, tmpColor.setScalar((1 - k) * 0.18));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, SPRAY_COUNT]}
      geometry={geometry}
      frustumCulled={false}
    >
      <meshBasicMaterial
        color="#dfe7f0"
        transparent
        opacity={0.2}
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
};

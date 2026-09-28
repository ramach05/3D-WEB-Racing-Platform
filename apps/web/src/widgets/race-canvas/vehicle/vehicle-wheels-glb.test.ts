import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Box3, Group, Quaternion, Vector3, type Object3D, type SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { normalizeVehicleGltf } from './vehicle-body-variants';
import {
  computeAxleLocal,
  computeSteerAxisLocal,
  computeToeYawCorrection,
  measureWheelAxle,
} from './vehicle-wheel-rig';

/*
 * Интеграция с реальными GLB колёс (scirocco / juke / hatchback-CarConcept).
 *
 * Проверяет:
 *  1) normalizeVehicleGltf маппит ровно по одному узлу на каждое из 4 имён колёс,
 *     при этом колесо — компактная деталь, а не «весь автомобиль»;
 *  2) замеренную ось шины (measureWheelAxle) + toe-коррекцию (computeToeYawCorrection)
 *     по реальной геометрии каждой модели (у Juke перед ~20°, у CarConcept ~30°);
 *  3) математику buildWheelRig без мутаций дерева: align обнуляет toe, spin крутит
 *     вокруг замеренной оси шины, steer — вокруг мировой вертикали (в т.ч. под
 *     повёрнутым родителем BodyUnderside −90° по X у CarConcept).
 *
 * Зависимости окружения:
 *  - GLTFLoader.parse требует ArrayBuffer из «своего» рилма (см. load ниже);
 *  - текстуры грузятся через fake createImageBitmap; чтобы их blob-фетчи не долетали
 *    до MSW (включённого setup.ts в режиме onUnhandledRequest: 'error'), in beforeAll
 *    этого файла globalThis.fetch временно подменяется стабом с пустым blob.
 */

(globalThis as { self?: object }).self = globalThis;
class FakeImage {
  _ol?: () => void;
  set onload(fn: () => void) {
    this._ol = fn;
  }
  get onload() {
    return this._ol as () => void;
  }
  set src(_v: string) {
    queueMicrotask(() => this._ol?.());
  }
}
class FakeImageBitmap {
  width = 1;
  height = 1;
  close() {}
}
(globalThis as { Image?: object }).Image = FakeImage;
(globalThis as { createImageBitmap?: object }).createImageBitmap = async () =>
  new FakeImageBitmap();

// Оригинальный fetch до того, как MSW заменит его своим перехватчиком в setup beforeAll.
// В этом файле мы вернём собственный стаб (см. beforeAll в describe ниже), чтобы
// blob-фетчи текстур из ImageBitmapLoader не долетали до MSW.
const ORIGINAL_FETCH = globalThis.fetch;

const FIXTURE_DIR = [
  join(process.cwd(), 'public', 'models', 'vehicle'),
  join(process.cwd(), 'apps', 'web', 'public', 'models', 'vehicle'),
].find((dir) => existsSync(join(dir, 'scirocco.glb')));
if (!FIXTURE_DIR) {
  throw new Error('vehicle GLB fixtures not found (looked in public/models/vehicle)');
}
const WHEEL_NAMES = ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR'] as const;

const load = async (fileName: string) => {
  const buf = readFileSync(join(FIXTURE_DIR, fileName));
  // Кросс-рилм: Buffer.buffer может не пройти `instanceof ArrayBuffer` в jsdom-рилме vitest.
  // Копируем байты в типизированный массив текущего рилма, чтобы GLTFLoader распарсил GLB как бинарный.
  const bytes = new Uint8Array(buf.byteLength);
  bytes.set(buf);
  const data: ArrayBuffer = bytes.buffer;
  const loader = new GLTFLoader();
  return new Promise<{ scene: Group }>((res, rej) => loader.parse(data, '', res, rej));
};

const isSkinned = (o: Object3D): o is SkinnedMesh =>
  (o as SkinnedMesh).isSkinnedMesh === true;

/** Выборка мировых точек геометрии: обычный matrixWorld или с учётом bindMatrix (rest-поза SkinnedMesh). */
const samplePts = (wheel: Object3D, useBind: boolean): Vector3[] => {
  const out: Vector3[] = [];
  let budget = 4096;
  wheel.updateWorldMatrix(true, true);
  wheel.traverse((o) => {
    if (!(o as SkinnedMesh).isMesh) {
      return;
    }
    const mesh = o as SkinnedMesh;
    const pos = mesh.geometry.getAttribute('position');
    if (!pos || budget <= 0) {
      return;
    }
    const count = pos.count;
    const stride = Math.max(1, Math.ceil(count / budget));
    for (let i = 0; i < count && budget > 0; i += stride, budget -= 1) {
      const v = new Vector3().fromBufferAttribute(pos, i);
      if (useBind && mesh.isSkinnedMesh) {
        v.applyMatrix4(mesh.bindMatrix).applyMatrix4(mesh.matrixWorld);
      } else {
        v.applyMatrix4(mesh.matrixWorld);
      }
      out.push(v);
    }
  });
  return out;
};

const widthAt = (pts: readonly Vector3[], cx: number, cz: number, deg: number): number => {
  const t = (deg * Math.PI) / 180;
  const a = Math.cos(t);
  const b = Math.sin(t);
  let mn = Number.POSITIVE_INFINITY;
  let mx = Number.NEGATIVE_INFINITY;
  for (const p of pts) {
    const proj = a * (p.x - cx) + b * (p.z - cz);
    mn = Math.min(mn, proj);
    mx = Math.max(mx, proj);
  }
  return mx - mn;
};

const minWidthDeg = (pts: readonly Vector3[], cx: number, cz: number) => {
  let yaw = 0;
  let w = Number.POSITIVE_INFINITY;
  for (let d = -90; d <= 90; d += 5) {
    const v = widthAt(pts, cx, cz, d);
    if (v < w) {
      w = v;
      yaw = d;
    }
  }
  for (let d = yaw - 6; d <= yaw + 6; d += 0.5) {
    const v = widthAt(pts, cx, cz, d);
    if (v < w) {
      w = v;
      yaw = d;
    }
  }
  const diameter = widthAt(pts, cx, cz, yaw + 90);
  return { deg: yaw, thinRatio: w / Math.max(diameter, 1e-6) };
};

const centerOf = (pts: readonly Vector3[]): { x: number; z: number } => {
  let cx = 0;
  let cz = 0;
  for (const p of pts) {
    cx += p.x;
    cz += p.z;
  }
  return { x: cx / pts.length, z: cz / pts.length };
};

const bearingDeg = (x: number, z: number): number => (Math.atan2(z, x) * 180) / Math.PI;

/** Разница азимутов в градусах, приведённая к (−180; 180]. */
const bearingDelta = (a: number, b: number): number => {
  let d = (b - a) % 360;
  if (d > 180) {
    d -= 360;
  }
  if (d < -180) {
    d += 360;
  }
  return d;
};

type TWheelDiag = {
  name: string;
  matches: number;
  rawBearing: number;
  skinned: number;
  skinnedMesh: string;
  nodeQuat: string;
  ptsCount: number;
  sweep: number[];
  rawDeg: number;
  rawThin: string;
  bindDeg: number;
  bindThin: string;
  centerRaw: string;
  centerBind: string;
  parentChain: string[];
  box: string;
  [key: string]: string | number | number[] | string[];
};

const wheelDiag = (root: Group, name: string): TWheelDiag => {
  const matches = root.getObjectsByProperty('name', name);
  const w = matches[0];
  const info: TWheelDiag = {
    name,
    matches: matches.length,
    rawBearing: 0,
    skinned: 0,
    skinnedMesh: '',
    nodeQuat: '',
    ptsCount: 0,
    sweep: [],
    rawDeg: 0,
    rawThin: '',
    bindDeg: 0,
    bindThin: '',
    centerRaw: '',
    centerBind: '',
    parentChain: [],
    box: '',
  };
  if (!w) {
    return info;
  }
  const rawAxle = measureWheelAxle(w);
  info.rawBearing = bearingDeg(rawAxle.x, rawAxle.z);

  let skinned = 0;
  let skinnedNamed = '';
  w.traverse((o) => {
    if (isSkinned(o)) {
      skinned += 1;
      skinnedNamed = o.name;
    }
  });
  info.skinned = skinned;
  info.skinnedMesh = skinnedNamed;
  info.nodeQuat = `${w.quaternion.x.toFixed(3)},${w.quaternion.y.toFixed(3)},${w.quaternion.z.toFixed(3)},${w.quaternion.w.toFixed(3)}`;

  const ptsRaw = samplePts(w, false);
  const ptsBind = samplePts(w, true);
  const cRaw = centerOf(ptsRaw);
  const cBind = centerOf(ptsBind);
  const mRaw = minWidthDeg(ptsRaw, cRaw.x, cRaw.z);
  const mBind = minWidthDeg(ptsBind, cBind.x, cBind.z);
  info.ptsCount = ptsRaw.length;
  info.sweep = [0, 30, 60, 90].map(
    (d) => +widthAt(ptsRaw, cRaw.x, cRaw.z, d).toFixed(3),
  );
  info.rawDeg = mRaw.deg;
  info.rawThin = mRaw.thinRatio.toFixed(2);
  info.bindDeg = mBind.deg;
  info.bindThin = mBind.thinRatio.toFixed(2);
  info.centerRaw = `(${cRaw.x.toFixed(2)}, ${cRaw.z.toFixed(2)})`;
  info.centerBind = `(${cBind.x.toFixed(2)}, ${cBind.z.toFixed(2)})`;

  // Цепочка родителей: имя + мировой quaternion на участках с поворотом.
  const chain: string[] = [];
  let cursor: Object3D | null = w.parent;
  while (cursor && chain.length < 5) {
    const q = cursor.getWorldQuaternion(new Quaternion());
    const nonIdentity =
      Math.abs(q.x) > 1e-3 || Math.abs(q.y) > 1e-3 || Math.abs(q.z) > 1e-3;
    chain.push(
      `${cursor.name}${
        nonIdentity ? ` q(${q.x.toFixed(2)},${q.y.toFixed(2)},${q.z.toFixed(2)},${q.w.toFixed(2)})` : ''
      }`,
    );
    cursor = cursor.parent;
  }
  info.parentChain = chain;

  const box = new Box3().setFromObject(w).getSize(new Vector3());
  info.box = `${box.x.toFixed(2)}×${box.y.toFixed(2)}×${box.z.toFixed(2)}`;
  return info;
};

const FRONT_WHEEL_NAMES = ['WheelFrontL', 'WheelFrontR'] as const;
const REAR_WHEEL_NAMES = ['WheelRearL', 'WheelRearR'] as const;

/** Запечённый toe передней оси в authored-позе (градусы) по реальным GLB. */
const FRONT_YAW_DEG: Record<string, number | undefined> = {
  scirocco: 0,
  juke: 20,
  hatchback: 30,
};

const DEBUG = Boolean(process.env.WHEEL_DEBUG);

describe('real glb wheel integration', () => {
  const cases = [
    ['scirocco', 'scirocco.glb'],
    ['juke', 'juke.glb'],
    ['hatchback', 'car-concept.glb'],
  ] as const;

  // setup.ts включает MSW с onUnhandledRequest: 'error'. Текстуры грузятся через
  // ImageBitmapLoader → fetch; подменяем fetch стабом с пустым blob, чтобы запросы
  // текстур не долетали до MSW (createImageBitmap из шапки файла сырой blob не читает).
  beforeAll(() => {
    const stub = async (): Promise<Response> =>
      new Response(new Blob([new Uint8Array(0)], { type: 'image/png' }), {
        status: 200,
      });
    (globalThis as { fetch: typeof fetch }).fetch = stub as typeof fetch;
  });

  afterAll(() => {
    (globalThis as { fetch: typeof fetch }).fetch = ORIGINAL_FETCH;
  });

  for (const [vehicleId, file] of cases) {
    it(`${vehicleId}: wheels mapped uniquely & compact, baked toe matches real GLB`, async () => {
      const gltf = await load(file);
      const root = cloneSkinned(gltf.scene) as Group;
      normalizeVehicleGltf(root, vehicleId);
      root.updateMatrixWorld(true);

      if (DEBUG) {
        console.log(`\n==== ${vehicleId} ====`);
        for (const name of WHEEL_NAMES) {
          console.log(JSON.stringify(wheelDiag(root, name)));
        }
      }

      for (const name of WHEEL_NAMES) {
        const matches = root.getObjectsByProperty('name', name);
        expect(matches.length, `${name} mapped exactly once (${matches.length})`).toBe(1);
        const w = matches[0];
        if (!w) {
          continue;
        }
        const size = new Box3().setFromObject(w).getSize(new Vector3());
        expect(size.x, `${name} is a wheel, not the whole car`).toBeLessThan(0.9);
        expect(size.z, `${name} is a wheel, not the whole car`).toBeLessThan(1.6);
      }

      const expectedYaw = FRONT_YAW_DEG[vehicleId];
      if (expectedYaw !== undefined) {
        for (const name of FRONT_WHEEL_NAMES) {
          const w = root.getObjectByName(name);
          if (!w) {
            continue;
          }
          const axle = measureWheelAxle(w);
          const yawCorrDeg = (computeToeYawCorrection(axle) * 180) / Math.PI;
          expect(yawCorrDeg, `${name} baked toe = ${expectedYaw}°`).toBeCloseTo(expectedYaw, 0);
        }
      }

      for (const name of REAR_WHEEL_NAMES) {
        const w = root.getObjectByName(name);
        if (w) {
          const axle = measureWheelAxle(w);
          const yaw = bearingDeg(axle.x, axle.z);
          expect(Math.abs(yaw), `${name} rear axle has no toe`).toBeLessThan(3);
        }
      }
    }, 30000);

    it(`${vehicleId}: rig projection zeroes toe, spins on axle, steers on world up`, async () => {
      const gltf = await load(file);
      const root = cloneSkinned(gltf.scene) as Group;
      normalizeVehicleGltf(root, vehicleId);
      root.updateMatrixWorld(true);

      let count = 0;
      for (const name of WHEEL_NAMES) {
        const wheel = root.getObjectByName(name);
        expect(wheel, `wheel ${name} exists`).toBeTruthy();
        if (wheel) {
          const p = projectWheelRig(wheel);
          expect(p, `project ${name}`).toBeTruthy();
          if (p) {
            count += 1;
            const label = `${vehicleId}/${p.name} (yawCorr ${p.yawCorrDeg.toFixed(1)}°, center ${p.centerLocal})`;
            expect(
              Math.abs(p.alignedBearingDeg),
              `${label}: align zeroes toe on real geometry`,
            ).toBeLessThan(2.5);
            expect(
              Math.abs(1 - p.spinWorldDot),
              `${label}: spin axis = measured wheel axle`,
            ).toBeLessThan(0.01);
            expect(
              Math.abs(1 - p.steerWorldDot),
              `${label}: steer axis = world up (parent ${p.parentWhom})`,
            ).toBeLessThan(0.01);
          }
        }
      }
      expect(count).toBe(WHEEL_NAMES.length);
    }, 30000);

    it(`${vehicleId}: attaching rig pivots keeps rest pose & axle (skinned-safe)`, async () => {
      const gltf = await load(file);

      // Эталон до мутаций: свежая нормализованная копия.
      const rootPre = cloneSkinned(gltf.scene) as Group;
      normalizeVehicleGltf(rootPre, vehicleId);
      rootPre.updateMatrixWorld(true);
      const pre = new Map<
        string,
        { axle: Vector3; bearing: number; center: Vector3 }
      >();
      for (const name of WHEEL_NAMES) {
        const w = rootPre.getObjectByName(name)!;
        const axle = measureWheelAxle(w);
        pre.set(name, {
          axle,
          bearing: bearingDeg(axle.x, axle.z),
          center: new Box3().setFromObject(w).getCenter(new Vector3()),
        });
      }

      // Повторяем продакшн-цепочку: pivot-иерархия + spinPivot.attach(wheel),
      // мерим ось после attach, ДО применения квитерниона align.
      const rootRig = cloneSkinned(gltf.scene) as Group;
      normalizeVehicleGltf(rootRig, vehicleId);
      rootRig.updateMatrixWorld(true);
      let rigged = 0;
      for (const name of WHEEL_NAMES) {
        const wheel = rootRig.getObjectByName(name);
        if (wheel) {
          const ok = attachRigPivots(wheel);
          if (ok) {
            rigged += 1;
          }
        }
      }
      rootRig.updateMatrixWorld(true);

      for (const name of WHEEL_NAMES) {
        const w = rootRig.getObjectByName(name);
        const ref = pre.get(name)!;
        const axle = measureWheelAxle(w!);
        const bearing = bearingDeg(axle.x, axle.z);
        const center = new Box3().setFromObject(w!).getCenter(new Vector3());
        const label = `${vehicleId}/${name}`;
        expect(
          Math.abs(bearing - ref.bearing),
          `${label}: axle unchanged after attach`,
        ).toBeLessThan(0.5);
        expect(
          center.distanceTo(ref.center),
          `${label}: center unchanged after attach`,
        ).toBeLessThan(0.02);
      }
      expect(rigged).toBe(WHEEL_NAMES.length);
    }, 30000);
  }

  it('scirocco (Sport): front wheels steer about world up, rear wheels stay straight', async () => {
    const gltf = await load('scirocco.glb');
    const root = cloneSkinned(gltf.scene) as Group;
    normalizeVehicleGltf(root, 'scirocco'); // Sport = scirocco
    root.updateMatrixWorld(true);

    // Тот же максимальный угол, что в vehicle-model.tsx (MAX_STEER_ANGLE ≈ 32°).
    const MAX_STEER = 0.56;

    type TRigged = {
      steerPivot: Group;
      steerAxisLocal: Vector3;
      bearing: () => number;
    };
    const rigs: Record<string, TRigged> = {};

    for (const name of WHEEL_NAMES) {
      const wheel = root.getObjectByName(name);
      expect(wheel, `wheel ${name} exists`).toBeTruthy();
      if (!wheel) {
        continue;
      }
      // Родитель до attach — именно его фрейм использует buildWheelRig для steerAxisLocal.
      const anchor = wheel.parent;
      expect(anchor, `parent ${name}`).toBeTruthy();
      if (!anchor) {
        continue;
      }
      // Продакшн-цепочка: steer → align → spin → attach.
      expect(attachRigPivots(wheel)).toBe(true);
      root.updateMatrixWorld(true);
      const steerPivot = root.getObjectByName(`${name}_steer`) as Group;
      const steerAxisLocal = computeSteerAxisLocal(anchor.getWorldQuaternion(new Quaternion()));
      rigs[name] = {
        steerPivot,
        steerAxisLocal,
        bearing: () => {
          const axle = measureWheelAxle(wheel);
          return bearingDeg(axle.x, axle.z);
        },
      };
    }

    const before: Record<string, number> = {};
    for (const name of WHEEL_NAMES) {
      before[name] = rigs[name]!.bearing();
    }

    // Рулим только передними пивотами — как applyWheelAnimation (isFront).
    for (const name of FRONT_WHEEL_NAMES) {
      const rig = rigs[name]!;
      rig.steerPivot.quaternion.setFromAxisAngle(rig.steerAxisLocal, MAX_STEER);
    }
    root.updateMatrixWorld(true);

    for (const name of FRONT_WHEEL_NAMES) {
      const delta = bearingDelta(before[name]!, rigs[name]!.bearing());
      expect(Math.abs(delta), `scirocco/${name}: front wheel visually steers`).toBeGreaterThan(5);
    }
    for (const name of REAR_WHEEL_NAMES) {
      const delta = bearingDelta(before[name]!, rigs[name]!.bearing());
      expect(Math.abs(delta), `scirocco/${name}: rear wheel stays straight`).toBeLessThan(0.5);
    }
  }, 30000);
});


/** Воспроизводит математику buildWheelRig без мутаций дерева: возвращает эффекты в мировых осях. */
const projectWheelRig = (wheel: Object3D) => {
  const parent = wheel.parent;
  if (!parent) {
    return null;
  }
  parent.updateMatrixWorld(true);
  wheel.updateMatrixWorld(true);

  const box = new Box3().setFromObject(wheel);
  const center = box.getCenter(new Vector3());
  parent.worldToLocal(center);

  const parentQ = parent.getWorldQuaternion(new Quaternion());
  const steerAxisLocal = computeSteerAxisLocal(parentQ);
  const axleWorld = measureWheelAxle(wheel);
  const yawCorr = computeToeYawCorrection(axleWorld);
  const axleLocal = computeAxleLocal(axleWorld, parentQ);

  // align поворот (yawCorr) выполняется вокруг steerAxisLocal в локальном фрейме пивота;
  // в мировых осях это поворот вокруг (0,1,0).
  const alignedWorld = axleWorld.clone().applyAxisAngle(new Vector3(0, 1, 0), yawCorr);
  const spinWorld = axleLocal.clone().applyQuaternion(parentQ).normalize();
  const steerAxisWorld = steerAxisLocal.clone().applyQuaternion(parentQ).normalize();
  return {
    name: wheel.name,
    parentWhom: parent.name,
    centerLocal: `(${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`,
    yawCorrDeg: (yawCorr * 180) / Math.PI,
    alignedBearingDeg: bearingDeg(alignedWorld.x, alignedWorld.z),
    spinWorldDot: Number(spinWorld.dot(axleWorld).toFixed(4)),
    steerWorldDot: Number(steerAxisWorld.dot(new Vector3(0, 1, 0)).toFixed(4)),
  };
};

/**
 * Воспроизводит продакшн-цепочку buildWheelRig (steer → align → spin → attach)
 * БЕЗ применения align-квитерниона: только сборка пивотов и spinPivot.attach(wheel),
 * как в vehicle-model.tsx. Используется для проверки, что attach не сдвигает
 * rest-позу колеса (в т.ч. SkinnedMesh у Scirocco).
 */
const attachRigPivots = (wheel: Object3D): boolean => {
  const parent = wheel.parent;
  if (!parent) {
    return false;
  }
  parent.updateMatrixWorld(true);
  wheel.updateMatrixWorld(true);

  const box = new Box3().setFromObject(wheel);
  const center = box.getCenter(new Vector3());
  parent.worldToLocal(center);

  const steerPivot = new Group();
  steerPivot.name = `${wheel.name}_steer`;
  steerPivot.position.copy(center);
  parent.add(steerPivot);

  const alignPivot = new Group();
  alignPivot.name = `${wheel.name}_align`;
  steerPivot.add(alignPivot);

  const spinPivot = new Group();
  spinPivot.name = `${wheel.name}_spin`;
  alignPivot.add(spinPivot);

  spinPivot.attach(wheel);
  return true;
};




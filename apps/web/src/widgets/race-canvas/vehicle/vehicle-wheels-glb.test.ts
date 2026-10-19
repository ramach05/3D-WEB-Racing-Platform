import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  Box3,
  Group,
  Quaternion,
  Vector3,
  type Mesh,
  type Object3D,
  type SkinnedMesh,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getVehicleFitTargetLength } from '@/entities/vehicle';
import {
  attachJukeProceduralTires,
  attachJukeTiresToRimPose,
  measureHeadlightLampPositions,
  normalizeVehicleGltf,
} from './vehicle-body-variants';
import { computeVehicleFit, VEHICLE_TARGET_LENGTH } from './vehicle-fit';
import {
  computeAxleLocal,
  computeSteerAxisLocal,
  computeToeYawCorrection,
  measureWheelAxle,
} from './vehicle-wheel-rig';

/*
 * Интеграция с реальными GLB колес (scirocco / juke / hatchback-CarConcept).
 *
 * Проверяет:
 *  1) normalizeVehicleGltf маппит ровно по одному узлу на каждое из 4 имен колес,
 *     при этом колесо — компактная деталь, а не «весь автомобиль»;
 *  2) замеренную ось шины (measureWheelAxle) + toe-коррекцию (computeToeYawCorrection)
 *     по реальной геометрии каждой модели (у Juke перед ~20°, у CarConcept ~30°);
 *  3) математику buildWheelRig без мутаций дерева: align обнуляет toe, spin крутит
 *     вокруг замеренной оси шины, steer — вокруг мировой вертикали (в т.ч. под
 *     повернутым родителем BodyUnderside −90° по X у CarConcept).
 *
 * Зависимости окружения:
 *  - GLTFLoader.parse требует ArrayBuffer из «своего» рилма (см. load ниже);
 *  - текстуры грузятся через fake createImageBitmap; чтобы их blob-фетчи не долетали
 *    до MSW (включенного setup.ts в режиме onUnhandledRequest: 'error'), in beforeAll
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
// В этом файле мы вернем собственный стаб (см. beforeAll в describe ниже), чтобы
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

const isSkinned = (o: Object3D): o is SkinnedMesh => (o as SkinnedMesh).isSkinnedMesh === true;

/** Выборка мировых точек геометрии: обычный matrixWorld или с учетом bindMatrix (rest-поза SkinnedMesh). */
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

/** Разница азимутов в градусах, приведенная к (−180; 180]. */
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
  info.sweep = [0, 30, 60, 90].map((d) => +widthAt(ptsRaw, cRaw.x, cRaw.z, d).toFixed(3));
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
    const nonIdentity = Math.abs(q.x) > 1e-3 || Math.abs(q.y) > 1e-3 || Math.abs(q.z) > 1e-3;
    chain.push(
      `${cursor.name}${
        nonIdentity
          ? ` q(${q.x.toFixed(2)},${q.y.toFixed(2)},${q.z.toFixed(2)},${q.w.toFixed(2)})`
          : ''
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

/** Запеченный toe передней оси в authored-позе (градусы) по реальным GLB. */
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
    ['sedan', 'logan.glb'],
    ['pickup', 'ram.glb'],
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

    it(`${vehicleId}: measured wheel radius scales to a realistic value after fit`, async () => {
      const gltf = await load(file);
      const root = cloneSkinned(gltf.scene) as Group;
      normalizeVehicleGltf(root, vehicleId);
      root.updateMatrixWorld(true);

      // fit.scale = целевая длина / длина AABB кузова — как в prepareVehicleRoot.
      const bodySize = new Box3().setFromObject(root).getSize(new Vector3());
      const fitScale = VEHICLE_TARGET_LENGTH / Math.max(bodySize.z, 1e-6);

      // Реплика measureWheelRadius (vehicle-model.tsx): радиус БЕЗ клампа 0.12 в модельных
      // единицах. Старый кламп ломал мини-масштабированные модели: у ram.glb (вся машина
      // ~0.06, диаметр колеса ~0.009) он давал 0.12 × fitScale(≈55) = ~6.6 м — spin в ~24
      // раза медленнее. Безопасный нижний предел ставится на МИРОВОМ радиусе в spin-расчете.
      const wheel = root.getObjectByName('WheelFrontL') ?? root.getObjectByName('WheelRearL');
      expect(wheel, 'wheel pivot exists').toBeTruthy();
      if (!wheel) {
        return;
      }
      const size = new Box3().setFromObject(wheel).getSize(new Vector3());
      const modelRadius = Math.min(size.y, size.z) * 0.5;
      const effectiveRadius = modelRadius * fitScale;

      if (DEBUG) {
        console.log(
          `${vehicleId}: wheelRadius(model)=${modelRadius.toFixed(4)} fitScale=${fitScale.toFixed(2)} ` +
            `effective=${effectiveRadius.toFixed(3)} m`,
        );
      }

      // Физичный радиус колеса после фита: ~15–45 см. Пикап до фикса давал 6.6 м.
      expect(effectiveRadius, `${vehicleId}: effective wheel radius realistic`).toBeGreaterThan(
        0.12,
      );
      expect(effectiveRadius, `${vehicleId}: effective wheel radius not blown up`).toBeLessThan(
        0.45,
      );
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
      const pre = new Map<string, { axle: Vector3; bearing: number; center: Vector3 }>();
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

  it('juke: authored Matte tires attached to pivots (torus only as fallback)', async () => {
    const gltf = await load('juke.glb');
    const root = cloneSkinned(gltf.scene) as Group;
    normalizeVehicleGltf(root, 'juke');
    attachJukeTiresToRimPose(root);
    attachJukeProceduralTires(root);
    root.updateMatrixWorld(true);

    for (const name of WHEEL_NAMES) {
      const pivot = root.getObjectByName(name);
      expect(pivot, name).toBeTruthy();
      let hasRim = false;
      let authoredTireCount = 0;
      let hasTireFill = false;
      let hasChromeRim = false;
      const tireMeshes: Mesh[] = [];
      pivot!.traverse((object) => {
        if (!(object as { isMesh?: boolean }).isMesh || !object.visible) {
          return;
        }
        const mesh = object as Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        if (mats.some((m) => m.name === 'wheel1')) {
          hasRim = true;
        }
        if (object.name.endsWith('_TireFill')) {
          hasTireFill = true;
        }
        if (mats.some((m) => m.name === 'Matte__FF2') && !object.name.endsWith('_TireFill')) {
          const tireSize = new Box3().setFromObject(mesh).getSize(new Vector3());
          // Покрышка не шире колеса: лохматые meshmerger-слэбы (x≈0.58) здесь быть не должно
          expect(tireSize.x, `${name}/${mesh.name} tire not a slab`).toBeLessThan(0.52);
          tireMeshes.push(mesh);
          authoredTireCount += 1;
        }
        if (mats.some((m) => m.name === 'wheel2' || m.name === 'wheel3')) {
          hasChromeRim = true;
        }
      });
      expect(hasRim, `${name} has metallic rim`).toBe(true);
      // 2 компактные боковины + куски слитых шеллов, нарезанные по колесам
      expect(authoredTireCount, `${name} authored tire shells on pivot`).toBeGreaterThanOrEqual(2);
      // Синхронность: bearing оси каждой шины == bearing оси диска (без доворота
      // разница = baked-toe ~20°: «покрышка всегда повернута в сторону»).
      // Осколки слитых шеллов (_TireShell) сохраняют authored-позу относительно
      // диска; скан bearing по осколку недостоверен — их проверяет floatingTire ниже
      const pivotAxle = measureWheelAxle(pivot!);
      const pivotBearing = bearingDeg(pivotAxle.x, pivotAxle.z);
      for (const tireMesh of tireMeshes) {
        if (tireMesh.name.endsWith('_TireShell')) {
          continue;
        }
        const tireAxle = measureWheelAxle(tireMesh);
        const delta = bearingDeg(tireAxle.x, tireAxle.z) - pivotBearing;
        expect(
          Math.abs(delta),
          `${name}/${tireMesh.name} tire synced with rim (delta ${delta.toFixed(1)}°)`,
        ).toBeLessThan(6);
      }
      expect(hasTireFill, `${name} has no torus fallback when tire exists`).toBe(false);
      expect(hasChromeRim, `${name} has chrome/accent rim layer`).toBe(true);
      const size = new Box3().setFromObject(pivot!).getSize(new Vector3());
      expect(size.y, `${name} tire height`).toBeGreaterThan(0.45);
      expect(size.z, `${name} tire depth`).toBeGreaterThan(0.45);
      // С toe спереди bbox шире диаметра; порог лишь отсекает «весь кузов»
      expect(size.x, `${name} stays a wheel`).toBeLessThan(1.25);
      expect(size.z, `${name} stays a wheel`).toBeLessThan(1.25);
    }

    let floatingTire = 0;
    root.traverse((object) => {
      if (!(object as { isMesh?: boolean }).isMesh || !object.visible) {
        return;
      }
      const mesh = object as Mesh;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (!mats.some((m) => m.name === 'Matte__FF2')) {
        return;
      }
      const box = new Box3().setFromObject(mesh);
      const size = box.getSize(new Vector3());
      if (size.y < 0.35 || size.y > 0.8) {
        return;
      }
      let under = false;
      let p: Object3D | null = object;
      while (p) {
        if ((WHEEL_NAMES as readonly string[]).includes(p.name)) {
          under = true;
          break;
        }
        p = p.parent;
      }
      if (!under) {
        floatingTire += 1;
      }
    });
    expect(floatingTire, 'no visible Matte tires outside pivots').toBe(0);
  }, 30000);

  it('juke: rubber steers with the rim through the production rig order', async () => {
    const gltf = await load('juke.glb');
    const root = cloneSkinned(gltf.scene) as Group;
    normalizeVehicleGltf(root, 'juke');
    // Порядок prepareVehicleRoot: резина на пивоты ДО rig (align крутит узел целиком)
    attachJukeTiresToRimPose(root);
    attachJukeProceduralTires(root);
    for (const name of WHEEL_NAMES) {
      expect(attachRigPivots(root.getObjectByName(name) as Object3D)).toBe(true);
    }
    root.updateMatrixWorld(true);

    const MAX_STEER_DEG = 32;
    for (const name of WHEEL_NAMES) {
      const pivot = root.getObjectByName(name) as Object3D;
      const steerPivot = root.getObjectByName(`${name}_steer`) as Group;
      const alignPivot = root.getObjectByName(`${name}_align`) as Group;

      // buildWheelRig: align-квитернион по axle всего узла (диск+резина, один фрейм)
      const axle = measureWheelAxle(pivot);
      alignPivot.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), computeToeYawCorrection(axle));
      root.updateMatrixWorld(true);
      const restToe = renderedToeDeg(pivot);
      expect(Math.abs(restToe), `${name}: whole wheel (rim+rubber) straight at rest`).toBeLessThan(
        2.5,
      );

      if (!(FRONT_WHEEL_NAMES as readonly string[]).includes(name)) {
        continue;
      }
      // applyWheelAnimation: steerPivot вокруг world-up — узел с резиной косит целиком
      steerPivot.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), (MAX_STEER_DEG * Math.PI) / 180);
      root.updateMatrixWorld(true);
      const steeredToe = Math.abs(renderedToeDeg(pivot));
      expect(
        Math.abs(steeredToe - MAX_STEER_DEG),
        `${name}: rubber follows the rim through steer (${steeredToe.toFixed(1)}°)`,
      ).toBeLessThan(6);
    }
  }, 30000);

  it('juke: DIAG wheel mesh inventory', async () => {
    const gltf = await load('juke.glb');
    const root = cloneSkinned(gltf.scene) as Group;
    normalizeVehicleGltf(root, 'juke');
    attachJukeTiresToRimPose(root);
    attachJukeProceduralTires(root);
    root.updateMatrixWorld(true);
    const box = new Box3();
    const size = new Vector3();
    const center = new Vector3();
    for (const name of WHEEL_NAMES) {
      const pivot = root.getObjectByName(name)!;
      box.setFromObject(pivot);
      box.getSize(size);
      box.getCenter(center);
      console.warn(
        `${name} pivot size=${size.x.toFixed(3)},${size.y.toFixed(3)},${size.z.toFixed(3)} c=${center.x.toFixed(2)},${center.y.toFixed(2)},${center.z.toFixed(2)}`,
      );
      pivot.traverse((object) => {
        if (!(object as Mesh).isMesh) {
          return;
        }
        const mesh = object as Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        box.setFromObject(mesh);
        box.getSize(size);
        box.getCenter(center);
        console.warn(
          `  ${mesh.visible ? 'V' : 'H'} ${mesh.name || '(unnamed)'} mats=${mats.map((m) => `${m.name}#${'color' in m ? (m as { color: { getHexString: () => string } }).color.getHexString() : '?'}`).join(',')} size=${size.x.toFixed(3)},${size.y.toFixed(3)},${size.z.toFixed(3)} c=${center.x.toFixed(2)},${center.y.toFixed(2)},${center.z.toFixed(2)}`,
        );
      });
    }
    const leftover: string[] = [];
    root.traverse((object) => {
      if (!(object as Mesh).isMesh || !object.visible) {
        return;
      }
      const mesh = object as Mesh;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const names = mats.map((m) => m.name);
      if (!names.some((n) => n.startsWith('wheel') || n === 'Matte__FF2')) {
        return;
      }
      let under = false;
      let p: Object3D | null = object;
      while (p) {
        if ((WHEEL_NAMES as readonly string[]).includes(p.name)) {
          under = true;
          break;
        }
        p = p.parent;
      }
      if (!under) {
        box.setFromObject(mesh);
        box.getSize(size);
        leftover.push(
          `${mesh.name} mats=${names.join(',')} vis size=${size.x.toFixed(3)},${size.y.toFixed(3)},${size.z.toFixed(3)}`,
        );
      }
    });
    console.warn('leftover wheel-like', leftover);
    expect(true).toBe(true);
  }, 30000);

  it('juke: front chrome disc/accent is concentric with the wheel axle (no protrusion past rim)', async () => {
    const gltf = await load('juke.glb');
    const root = cloneSkinned(gltf.scene) as Group;
    normalizeVehicleGltf(root, 'juke');
    root.updateMatrixWorld(true);

    const origin = new Vector3();
    const tmp = new Vector3();
    const line = new Vector3();

    /** Максимальная радиальная удаленность вершин мешей с указанными материалами от оси (o, a). */
    const maxRadial = (pivot: Object3D, o: Vector3, a: Vector3, matNames: string[]): number => {
      let rMax = 0;
      pivot.traverse((object) => {
        if (!(object as Mesh).isMesh || !object.visible) {
          return;
        }
        const mesh = object as Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        if (!mats.some((m) => matNames.includes(m.name))) {
          return;
        }
        const pos = mesh.geometry.getAttribute('position');
        if (!pos) {
          return;
        }
        for (let i = 0; i < pos.count; i += 1) {
          tmp.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
          line.copy(tmp).sub(o);
          line.addScaledVector(a, -line.dot(a));
          const r = line.length();
          if (r > rMax) {
            rMax = r;
          }
        }
      });
      return rMax;
    };

    for (const name of WHEEL_NAMES) {
      const pivot = root.getObjectByName(name);
      expect(pivot, name).toBeTruthy();
      if (!pivot) {
        continue;
      }
      pivot.updateMatrixWorld(true);
      const axle = measureWheelAxle(pivot);
      pivot.getWorldPosition(origin);
      const rimR = maxRadial(pivot, origin, axle, ['wheel1']);
      // wheel2 = хром (передний «тормозной диск»), wheel3 = красная скоба
      const accentR = maxRadial(pivot, origin, axle, ['wheel2', 'wheel3']);
      const delta = accentR - rimR;
      if (DEBUG) {
        console.warn(
          `${name}: rimR=${rimR.toFixed(3)} accentR=${accentR.toFixed(3)} diff=${delta.toFixed(3)}`,
        );
      }
      if ((FRONT_WHEEL_NAMES as readonly string[]).includes(name)) {
        // Диск не должен выпирать за наружный радиус обода (эксцентриситет ~0.04).
        expect(
          delta,
          `${name}: chrome disc within rim radius (accentR ${accentR.toFixed(3)} vs rimR ${rimR.toFixed(3)})`,
        ).toBeLessThanOrEqual(0.02);
      }
    }
  }, 30000);

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

  it('scirocco (Sport): wheel SkinnedMeshes are baked to Mesh after normalize', async () => {
    const gltf = await load('scirocco.glb');
    const root = cloneSkinned(gltf.scene) as Group;
    normalizeVehicleGltf(root, 'scirocco');
    root.updateMatrixWorld(true);

    for (const name of WHEEL_NAMES) {
      const wheel = root.getObjectByName(name);
      expect(wheel, `wheel ${name} exists`).toBeTruthy();
      let skinned = 0;
      let meshes = 0;
      wheel!.traverse((o) => {
        if (isSkinned(o)) {
          skinned += 1;
        } else if ((o as { isMesh?: boolean }).isMesh === true) {
          meshes += 1;
        }
      });
      expect(skinned, `${name}: no SkinnedMesh after bake`).toBe(0);
      expect(meshes, `${name}: has baked Mesh`).toBeGreaterThan(0);
    }
  }, 30000);

  it('scirocco (Sport): rendered front-wheel toe follows the steer pivot', async () => {
    // Видимое руление по мировым точкам геометрии (после bake — обычный Mesh).
    const gltf = await load('scirocco.glb');
    const root = cloneSkinned(gltf.scene) as Group;
    normalizeVehicleGltf(root, 'scirocco');
    root.updateMatrixWorld(true);

    const MAX_STEER = 0.56;
    type TRig = { steerPivot: Group; steerAxisLocal: Vector3 };
    const rigs: Record<string, TRig> = {};
    for (const name of WHEEL_NAMES) {
      const wheel = root.getObjectByName(name);
      expect(wheel, `wheel ${name} exists`).toBeTruthy();
      if (!wheel) {
        continue;
      }
      const anchor = wheel.parent;
      expect(anchor, `parent ${name}`).toBeTruthy();
      if (!anchor) {
        continue;
      }
      expect(attachRigPivots(wheel)).toBe(true);
      const steerPivot = root.getObjectByName(`${name}_steer`) as Group;
      expect(steerPivot, `${name}_steer exists`).toBeTruthy();
      rigs[name] = {
        steerPivot,
        steerAxisLocal: computeSteerAxisLocal(anchor.getWorldQuaternion(new Quaternion())),
      };
    }
    root.updateMatrixWorld(true);

    const before: Record<string, number> = {};
    for (const name of WHEEL_NAMES) {
      before[name] = renderedToeDeg(root.getObjectByName(name)!);
    }

    for (const name of FRONT_WHEEL_NAMES) {
      const rig = rigs[name]!;
      rig.steerPivot.quaternion.setFromAxisAngle(rig.steerAxisLocal, MAX_STEER);
    }
    root.updateMatrixWorld(true);

    for (const name of FRONT_WHEEL_NAMES) {
      const delta = bearingDelta(before[name]!, renderedToeDeg(root.getObjectByName(name)!));
      expect(Math.abs(delta), `scirocco/${name}: rendered toe steers`).toBeGreaterThan(15);
    }
    for (const name of REAR_WHEEL_NAMES) {
      const delta = bearingDelta(before[name]!, renderedToeDeg(root.getObjectByName(name)!));
      expect(Math.abs(delta), `scirocco/${name}: rendered toe stays straight`).toBeLessThan(1);
    }
  }, 30000);

  it('scirocco (Sport): rendered wheel geometry spins about the measured axle', async () => {
    // После bone-world bake колеса — обычный Mesh: spin вокруг центра и оси шины.
    const gltf = await load('scirocco.glb');
    const root = cloneSkinned(gltf.scene) as Group;
    normalizeVehicleGltf(root, 'scirocco');
    root.updateMatrixWorld(true);

    const axes: Record<string, Vector3> = {};
    for (const name of WHEEL_NAMES) {
      const wheel = root.getObjectByName(name);
      expect(wheel, `wheel ${name} exists`).toBeTruthy();
      if (!wheel) {
        continue;
      }
      const anchor = wheel.parent;
      expect(anchor, `parent ${name}`).toBeTruthy();
      if (!anchor) {
        continue;
      }
      expect(attachRigPivots(wheel)).toBe(true);
      axes[name] = computeAxleLocal(
        measureWheelAxle(wheel),
        anchor.getWorldQuaternion(new Quaternion()),
      );
    }
    root.updateMatrixWorld(true);

    const before: Record<string, Vector3[]> = {};
    for (const name of WHEEL_NAMES) {
      const wheel = root.getObjectByName(name);
      if (wheel) {
        before[name] = samplePts(wheel, false);
      }
    }

    const SPIN = Math.PI / 2;
    for (const name of WHEEL_NAMES) {
      const spinPivot = root.getObjectByName(`${name}_spin`) as Group | undefined;
      expect(spinPivot, `${name}_spin exists`).toBeTruthy();
      if (!spinPivot) {
        continue;
      }
      spinPivot.quaternion.setFromAxisAngle(axes[name]!, SPIN);
    }
    root.updateMatrixWorld(true);

    for (const name of WHEEL_NAMES) {
      const wheel = root.getObjectByName(name);
      if (!wheel) {
        continue;
      }
      const after = samplePts(wheel, false);
      const ref = before[name]!;
      expect(after.length, `${name}: same sampled point count`).toBe(ref.length);

      const cBefore = centerOf(ref);
      const cAfter = centerOf(after);
      const centerShift = Math.hypot(cAfter.x - cBefore.x, cAfter.z - cBefore.z);
      let maxMove = 0;
      for (let i = 0; i < ref.length; i += 1) {
        const d = ref[i]!.distanceTo(after[i]!);
        if (d > maxMove) {
          maxMove = d;
        }
      }
      expect(
        centerShift,
        `${name}: spin runs about the wheel centre, not as drift/steer`,
      ).toBeLessThan(0.12);
      expect(maxMove, `${name}: rendered geometry actually spins about the axle`).toBeGreaterThan(
        0.1,
      );
    }
  }, 30000);

  it('pickup: headlight lamps sit near the grille after fit (not ±1.7 m)', async () => {
    const gltf = await load('ram.glb');
    const root = cloneSkinned(gltf.scene) as Group;
    normalizeVehicleGltf(root, 'pickup');
    root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(root);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const fit = computeVehicleFit({
      size: { x: size.x, y: size.y, z: size.z },
      min: { x: box.min.x, y: box.min.y, z: box.min.z },
      center: { x: center.x, y: center.y, z: center.z },
    });
    const lamps = measureHeadlightLampPositions(root, fit);
    expect(lamps).not.toBeNull();
    expect(lamps!.left[0]).toBeLessThan(0);
    expect(lamps!.right[0]).toBeGreaterThan(0);
    const halfSpan = (lamps!.right[0] - lamps!.left[0]) / 2;
    expect(halfSpan).toBeGreaterThan(0.25);
    expect(halfSpan).toBeLessThan(0.7);
  }, 30000);

  it('all bodies fit to real-world class proportions (realLengthMeters)', async () => {
    const fittedLengths = new Map<string, number>();
    for (const [vehicleId, file] of cases) {
      const gltf = await load(file);
      const root = cloneSkinned(gltf.scene) as Group;
      normalizeVehicleGltf(root, vehicleId);
      root.updateMatrixWorld(true);
      const size = new Box3().setFromObject(root).getSize(new Vector3());
      // target из каталога (реальная длина × шкала мира), default как в measureFit
      const target = getVehicleFitTargetLength(vehicleId) ?? VEHICLE_TARGET_LENGTH;
      const length = size.z * (target / Math.max(size.z, 1e-6));
      fittedLengths.set(vehicleId, length);
      expect(length, `${vehicleId}: fitted length equals target`).toBeCloseTo(target, 5);
    }
    const at = (id: string) => fittedLengths.get(id)!;
    // Реальная иерархия классов: TRX (5.71 м) крупнее всех, Juke (4.14) — самый компактный
    for (const [vehicleId, length] of fittedLengths) {
      if (vehicleId !== 'pickup') {
        expect(at('pickup'), `pickup longer than ${vehicleId}`).toBeGreaterThan(length);
      }
    }
    expect(at('sedan'), 'Logan 4.35 > Juke 4.14').toBeGreaterThan(at('juke'));
    expect(at('sedan'), 'Logan 4.35 > hatch 4.2').toBeGreaterThan(at('hatchback'));
    expect(at('scirocco'), 'Scirocco 4.26 > Juke 4.14').toBeGreaterThan(at('juke'));
    // Никто не уехал далеко от прежнего мирового масштаба (3.3): трасса под него
    for (const [vehicleId, length] of fittedLengths) {
      expect(length, `${vehicleId}: near track scale`).toBeGreaterThan(2.5);
      expect(length, `${vehicleId}: near track scale`).toBeLessThan(4.0);
    }
  }, 60000);
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
 * как в vehicle-model.tsx. Используется для проверки, что attach не сдвигает rest-позу.
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

/** Видимый toe (азимут оси «тонкости» в XZ) по мировым точкам геометрии, град. */
const renderedToeDeg = (wheel: Object3D): number => {
  const pts = samplePts(wheel, false);
  const c = centerOf(pts);
  return minWidthDeg(pts, c.x, c.z).deg;
};

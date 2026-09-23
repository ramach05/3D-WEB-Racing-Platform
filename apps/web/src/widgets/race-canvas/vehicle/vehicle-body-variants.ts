import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import type { TVehicleId } from '@/entities/vehicle';

/**
 * Седан / пикап: мягкий цельный warp вершин.
 * Длина AABB сохраняется, root.scale = (1,1,1) — иначе риг колёс на
 * BodyUnderside (−90° X) скашивается. Агрессивный Y-scale ломает сетку CarConcept —
 * профили держатся близко к 1. Геометрию клонируем до записи (кэш useGLTF).
 */

/** Бамп ревизии — ломает useMemo клона при HMR морфов */
export const VEHICLE_VARIANT_REV = 10;

const WHEEL_NAMES = ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR'] as const;

type TAxlePins = {
  frontZ: number;
  rearZ: number;
  midZ: number;
  beltY: number;
  wheelY: number;
  trackHalfX: number;
  wheelRadius: number;
  bodyMinZ: number;
  bodyMaxZ: number;
};

type TWarpProfile = {
  /** >0 оси к центру (длиннее свесы), <0 оси врозь (длиннее база) */
  axleInset: number;
  roofScaleY: number;
  trunkScaleY: number;
  trunkStartT: number;
  /** >0 кузов ниже, <0 выше клиренс — только лёгкие значения */
  bodyDropY: number;
  bodyScaleX: number;
  hoodScaleY: number;
  hoodEndT: number;
};

type TWheelEnrich = {
  diameterScale: number;
  widthScale: number;
  rimTint?: string;
};

const tmpBox = new Box3();
const tmpSize = new Vector3();
const tmpCenter = new Vector3();
const tmpWorld = new Vector3();
const tmpLocal = new Vector3();
const tmpAxle = new Vector3();
const tmpOffset = new Vector3();
const tmpRadial = new Vector3();
const tmpAlong = new Vector3();
const tmpQuat = new Quaternion();

const isMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true;

const isWheelRelated = (object: Object3D): boolean => {
  let current: Object3D | null = object;
  while (current) {
    const { name } = current;
    if (name.startsWith('Wheel') || name === 'Axles') {
      return true;
    }
    current = current.parent;
  }
  return false;
};

const cloneAllGeometries = (root: Object3D) => {
  root.traverse((object) => {
    if (!isMesh(object)) {
      return;
    }
    object.geometry = object.geometry.clone();
  });
};

const findNamedMaterial = (root: Object3D, prefix: string): MeshStandardMaterial | null => {
  let found: MeshStandardMaterial | null = null;
  root.traverse((object) => {
    if (found || !isMesh(object)) {
      return;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material as MeshStandardMaterial).isMeshStandardMaterial) {
        continue;
      }
      if (!material.name.startsWith(prefix) && material.name !== prefix) {
        continue;
      }
      found = material.clone();
      return;
    }
  });
  return found;
};

const clonePaintMaterial = (root: Object3D): MeshStandardMaterial =>
  findNamedMaterial(root, 'Paint') ??
  new MeshStandardMaterial({
    name: 'Paint',
    color: '#ffffff',
    metalness: 0.45,
    roughness: 0.35,
  });

const cloneOrCreateEmissive = (
  root: Object3D,
  name: 'Headlight' | 'Brakelight' | 'Signallight',
  fallbackColor: string,
): MeshStandardMaterial => {
  const existing = findNamedMaterial(root, name);
  if (existing) {
    existing.name = name;
    return existing;
  }
  return new MeshStandardMaterial({
    name,
    color: fallbackColor,
    emissive: fallbackColor,
    emissiveIntensity: 0.05,
    metalness: 0.1,
    roughness: 0.4,
  });
};

const measureAxlePins = (root: Object3D): TAxlePins => {
  root.updateMatrixWorld(true);

  const frontCenters: Vector3[] = [];
  const rearCenters: Vector3[] = [];
  for (const name of WHEEL_NAMES) {
    const wheel = root.getObjectByName(name);
    if (!wheel) {
      continue;
    }
    tmpBox.setFromObject(wheel);
    tmpBox.getCenter(tmpCenter);
    const center = tmpCenter.clone();
    if (name.startsWith('WheelFront')) {
      frontCenters.push(center);
    } else {
      rearCenters.push(center);
    }
  }

  const avg = (points: Vector3[], axis: 'x' | 'y' | 'z') =>
    points.reduce((sum, point) => sum + point[axis], 0) / Math.max(points.length, 1);
  const avgAbsX = (points: Vector3[]) =>
    points.reduce((sum, point) => sum + Math.abs(point.x), 0) / Math.max(points.length, 1);

  const allWheels = [...frontCenters, ...rearCenters];
  let wheelRadius = 0.42;
  if (allWheels.length > 0) {
    const sample = root.getObjectByName(WHEEL_NAMES[0]);
    if (sample) {
      tmpBox.setFromObject(sample);
      tmpBox.getSize(tmpSize);
      wheelRadius = Math.max(tmpSize.y, tmpSize.z) * 0.5;
    }
  }

  tmpBox.setFromObject(root);
  const frontZ = frontCenters.length > 0 ? avg(frontCenters, 'z') : tmpBox.max.z * 0.55;
  const rearZ = rearCenters.length > 0 ? avg(rearCenters, 'z') : tmpBox.min.z * 0.55;
  const wheelY = allWheels.length > 0 ? avg(allWheels, 'y') : 0.35;
  const trackHalfX = allWheels.length > 0 ? avgAbsX(allWheels) : 0.8;

  return {
    frontZ,
    rearZ,
    midZ: (frontZ + rearZ) * 0.5,
    beltY: wheelY + wheelRadius * 0.55,
    wheelY,
    trackHalfX,
    wheelRadius,
    bodyMinZ: tmpBox.min.z,
    bodyMaxZ: tmpBox.max.z,
  };
};

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  if (edge0 === edge1) {
    return value >= edge1 ? 1 : 0;
  }
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const mapSegment = (z: number, a0: number, a1: number, b0: number, b1: number): number => {
  if (Math.abs(a1 - a0) < 1e-8) {
    return b0;
  }
  return b0 + ((z - a0) / (a1 - a0)) * (b1 - b0);
};

const remapZPreserveLength = (
  z: number,
  pins: TAxlePins,
  newFront: number,
  newRear: number,
): number => {
  const { frontZ: oldFront, rearZ: oldRear, bodyMinZ: zMin, bodyMaxZ: zMax } = pins;
  if (z <= oldRear) {
    return mapSegment(z, zMin, oldRear, zMin, newRear);
  }
  if (z >= oldFront) {
    return mapSegment(z, oldFront, zMax, newFront, zMax);
  }
  return mapSegment(z, oldRear, oldFront, newRear, newFront);
};

const warpWorldPoint = (
  point: Vector3,
  pins: TAxlePins,
  profile: TWarpProfile,
  newFront: number,
  newRear: number,
) => {
  const { x, y, z } = point;
  const { beltY, wheelY, wheelRadius } = pins;
  const wheelbase = Math.max(newFront - newRear, 1e-3);
  const newMid = (newFront + newRear) * 0.5;
  const zOut = remapZPreserveLength(z, pins, newFront, newRear);
  const yDropped = y - profile.bodyDropY;

  // Арки: только bodyDrop + ширина — без roof/trunk, иначе «чужие» крылья
  const archR = wheelRadius * 1.4;
  const nearFrontArch = Math.hypot(yDropped - wheelY, zOut - newFront) < archR;
  const nearRearArch = Math.hypot(yDropped - wheelY, zOut - newRear) < archR;
  if ((nearFrontArch || nearRearArch) && yDropped < wheelY + wheelRadius * 1.1) {
    point.set(x * profile.bodyScaleX, yDropped, zOut);
    return;
  }

  const trunkZ = newRear + wheelbase * profile.trunkStartT;
  const hoodZ = newFront - wheelbase * profile.hoodEndT;
  let yOut = yDropped;

  if (yOut > beltY) {
    const above = yOut - beltY;
    if (zOut >= hoodZ) {
      const hoodBlend = smoothstep(hoodZ - wheelbase * 0.1, hoodZ + wheelbase * 0.15, zOut);
      yOut = beltY + above * (1 + (profile.hoodScaleY - 1) * hoodBlend);
    } else if (zOut <= trunkZ) {
      const trunkBlend = 1 - smoothstep(trunkZ, trunkZ + wheelbase * 0.2, zOut);
      yOut = beltY + above * (1 + (profile.trunkScaleY - 1) * trunkBlend);
    } else {
      const cabinBlend = smoothstep(trunkZ, newMid + (newFront - newMid) * 0.3, zOut);
      yOut = beltY + above * (1 + (profile.roofScaleY - 1) * cabinBlend);
    }
  }

  point.set(x * profile.bodyScaleX, yOut, zOut);
};

const warpBodyMeshes = (
  root: Object3D,
  pins: TAxlePins,
  profile: TWarpProfile,
  newFront: number,
  newRear: number,
) => {
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!isMesh(object) || isWheelRelated(object)) {
      return;
    }
    const geometry = object.geometry as BufferGeometry;
    const position = geometry.getAttribute('position');
    if (!position) {
      return;
    }
    for (let i = 0; i < position.count; i += 1) {
      tmpLocal.fromBufferAttribute(position, i);
      object.localToWorld(tmpWorld.copy(tmpLocal));
      warpWorldPoint(tmpWorld, pins, profile, newFront, newRear);
      object.worldToLocal(tmpLocal.copy(tmpWorld));
      position.setXYZ(i, tmpLocal.x, tmpLocal.y, tmpLocal.z);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  });
};

const shiftWheelToWorldZ = (wheel: Object3D, targetZ: number) => {
  const parent = wheel.parent;
  if (!parent) {
    return;
  }
  parent.updateMatrixWorld(true);
  wheel.updateMatrixWorld(true);
  tmpBox.setFromObject(wheel);
  tmpBox.getCenter(tmpCenter);
  const fromLocal = parent.worldToLocal(tmpCenter.clone());
  const toLocal = parent.worldToLocal(new Vector3(tmpCenter.x, tmpCenter.y, targetZ));
  wheel.position.x += toLocal.x - fromLocal.x;
  wheel.position.y += toLocal.y - fromLocal.y;
  wheel.position.z += toLocal.z - fromLocal.z;
};

const moveAxlesTo = (root: Object3D, newFront: number, newRear: number) => {
  root.updateMatrixWorld(true);
  for (const name of WHEEL_NAMES) {
    const wheel = root.getObjectByName(name);
    if (!wheel) {
      continue;
    }
    shiftWheelToWorldZ(wheel, name.startsWith('WheelFront') ? newFront : newRear);
  }
};

const enrichWheels = (root: Object3D, enrich: TWheelEnrich) => {
  root.updateMatrixWorld(true);
  for (const name of WHEEL_NAMES) {
    const wheel = root.getObjectByName(name);
    if (!wheel) {
      continue;
    }
    tmpBox.setFromObject(wheel);
    tmpBox.getCenter(tmpCenter);
    const center = tmpCenter.clone();
    tmpAxle.set(1, 0, 0).applyQuaternion(wheel.getWorldQuaternion(tmpQuat)).normalize();

    wheel.traverse((object) => {
      if (!isMesh(object)) {
        return;
      }
      const geometry = object.geometry as BufferGeometry;
      const position = geometry.getAttribute('position');
      if (!position) {
        return;
      }
      for (let i = 0; i < position.count; i += 1) {
        tmpLocal.fromBufferAttribute(position, i);
        object.localToWorld(tmpWorld.copy(tmpLocal));
        tmpOffset.copy(tmpWorld).sub(center);
        const along = tmpOffset.dot(tmpAxle);
        tmpAlong.copy(tmpAxle).multiplyScalar(along);
        tmpRadial.copy(tmpOffset).sub(tmpAlong);
        tmpRadial.multiplyScalar(enrich.diameterScale);
        tmpAlong.multiplyScalar(enrich.widthScale);
        tmpWorld.copy(center).add(tmpRadial).add(tmpAlong);
        object.worldToLocal(tmpLocal.copy(tmpWorld));
        position.setXYZ(i, tmpLocal.x, tmpLocal.y, tmpLocal.z);
      }
      position.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      if (enrich.rimTint) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (!(material as MeshStandardMaterial).isMeshStandardMaterial) {
            continue;
          }
          if (!material.name.startsWith('Rim')) {
            continue;
          }
          material.color.set(enrich.rimTint);
        }
      }
    });
  }
};

const widenTrack = (root: Object3D, extraHalfX: number) => {
  if (Math.abs(extraHalfX) < 1e-6) {
    return;
  }
  root.updateMatrixWorld(true);
  for (const name of WHEEL_NAMES) {
    const wheel = root.getObjectByName(name);
    if (!wheel) {
      continue;
    }
    tmpBox.setFromObject(wheel);
    tmpBox.getCenter(tmpCenter);
    const sign = tmpCenter.x >= 0 ? 1 : -1;
    wheel.position.x += sign * extraHalfX;
  }
};

const addMesh = (
  parent: Object3D,
  name: string,
  geometry: BufferGeometry,
  material: MeshStandardMaterial,
  position: [number, number, number],
) => {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

/** Узкие оверлеи фар/стопов — седан читается иначе, стоковые фары не прячем */
const addSedanLightOverlays = (root: Object3D, pins: TAxlePins) => {
  const headlightMat = cloneOrCreateEmissive(root, 'Headlight', '#f5f0d8');
  const brakeMat = cloneOrCreateEmissive(root, 'Brakelight', '#ff2200');
  const lamps = new Group();
  lamps.name = 'SedanCustomLights';
  root.add(lamps);

  const hx = pins.trackHalfX * 0.7;
  const lampY = pins.beltY * 0.88;
  const lampZ = pins.frontZ + (pins.bodyMaxZ - pins.frontZ) * 0.48;
  const lampW = pins.trackHalfX * 0.3;
  const lampH = pins.wheelRadius * 0.2;
  const lampD = pins.wheelRadius * 0.07;

  addMesh(lamps, 'SedanHeadlightL', new BoxGeometry(lampW, lampH, lampD), headlightMat, [
    hx,
    lampY,
    lampZ,
  ]);
  addMesh(lamps, 'SedanHeadlightR', new BoxGeometry(lampW, lampH, lampD), headlightMat, [
    -hx,
    lampY,
    lampZ,
  ]);

  const tailY = pins.beltY * 1.0;
  const tailZ = pins.rearZ - (pins.rearZ - pins.bodyMinZ) * 0.38;
  addMesh(
    lamps,
    'SedanTailBar',
    new BoxGeometry(pins.trackHalfX * 1.35, pins.wheelRadius * 0.14, pins.wheelRadius * 0.07),
    brakeMat,
    [0, tailY, tailZ],
  );
};

/**
 * Кузов пикапа: борта грузовой платформы за кабиной — лежат на кузове,
 * без «висящих» труб и без отрыва от шасси.
 */
const addPickupBedRails = (root: Object3D, pins: TAxlePins) => {
  const paint = clonePaintMaterial(root);
  paint.color.set('#1a1a18');
  paint.metalness = 0.65;
  paint.roughness = 0.5;

  const bed = new Group();
  bed.name = 'PickupBedRails';
  root.add(bed);

  const bedLen = Math.max(pins.rearZ - pins.bodyMinZ, 0.4) * 0.95;
  const bedZ = (pins.rearZ + pins.bodyMinZ) * 0.5;
  const bedY = pins.beltY + pins.wheelRadius * 0.05;
  const railH = pins.wheelRadius * 0.32;
  const railW = pins.wheelRadius * 0.1;
  const x = pins.trackHalfX * 0.82;

  // Пол платформы — тонкая плита между бортами
  addMesh(
    bed,
    'PickupBedFloor',
    new BoxGeometry(x * 2 - railW, pins.wheelRadius * 0.06, bedLen * 0.92),
    paint,
    [0, bedY - railH * 0.15, bedZ],
  );
  addMesh(bed, 'PickupRailL', new BoxGeometry(railW, railH, bedLen), paint, [
    x,
    bedY + railH * 0.25,
    bedZ,
  ]);
  addMesh(bed, 'PickupRailR', new BoxGeometry(railW, railH, bedLen), paint, [
    -x,
    bedY + railH * 0.25,
    bedZ,
  ]);
  addMesh(
    bed,
    'PickupRailTail',
    new BoxGeometry(x * 2 + railW, railH * 0.9, railW * 1.1),
    paint,
    [0, bedY + railH * 0.2, bedZ - bedLen * 0.48],
  );
};

/**
 * Седан: лёгкий 3-box — чуть длиннее свесы, чуть ниже корма/капот.
 * Без сплющивания кабины (иначе «раздавленная» крыша).
 */
const SEDAN_WARP: TWarpProfile = {
  axleInset: 0.08,
  roofScaleY: 0.96,
  trunkScaleY: 0.72,
  trunkStartT: 0.18,
  bodyDropY: 0.03,
  bodyScaleX: 1.02,
  hoodScaleY: 0.9,
  hoodEndT: 0.22,
};

/**
 * Пикап: чуть выше посадка, чуть длиннее база, мягче корма (= кузов).
 * bodyDropY маленький — иначе кузов «висит» над колёсами.
 */
const PICKUP_WARP: TWarpProfile = {
  axleInset: -0.05,
  roofScaleY: 1.06,
  trunkScaleY: 0.78,
  trunkStartT: 0.16,
  bodyDropY: -0.05,
  bodyScaleX: 1.05,
  hoodScaleY: 1.04,
  hoodEndT: 0.2,
};

const SEDAN_WHEELS: TWheelEnrich = {
  diameterScale: 1.02,
  widthScale: 1.06,
  rimTint: '#4a4844',
};

const PICKUP_WHEELS: TWheelEnrich = {
  diameterScale: 1.06,
  widthScale: 1.1,
  rimTint: '#2e2e2c',
};

const applyProfile = (root: Object3D, profile: TWarpProfile) => {
  const pins = measureAxlePins(root);
  const wheelbase = Math.max(pins.frontZ - pins.rearZ, 1e-3);
  const newFront = pins.frontZ - profile.axleInset * wheelbase;
  const newRear = pins.rearZ + profile.axleInset * wheelbase;
  warpBodyMeshes(root, pins, profile, newFront, newRear);
  moveAxlesTo(root, newFront, newRear);
  return pins;
};

const applySedanVariant = (root: Object3D) => {
  cloneAllGeometries(root);
  applyProfile(root, SEDAN_WARP);
  enrichWheels(root, SEDAN_WHEELS);
  root.updateMatrixWorld(true);
  const pinsAfter = measureAxlePins(root);
  tmpBox.setFromObject(root);
  pinsAfter.bodyMinZ = tmpBox.min.z;
  pinsAfter.bodyMaxZ = tmpBox.max.z;
  addSedanLightOverlays(root, pinsAfter);
  root.scale.set(1, 1, 1);
};

const applyPickupVariant = (root: Object3D) => {
  cloneAllGeometries(root);
  const pins = applyProfile(root, PICKUP_WARP);
  widenTrack(root, pins.trackHalfX * 0.03);
  enrichWheels(root, PICKUP_WHEELS);
  root.updateMatrixWorld(true);
  const pinsAfter = measureAxlePins(root);
  addPickupBedRails(root, pinsAfter);
  root.scale.set(1, 1, 1);
};

/**
 * Превращает клон CarConcept в силуэт гаражного кузова.
 * Хэтчбек — без изменений (authored hatch).
 */
export const applyVehicleBodyVariant = (root: Object3D, vehicleId: TVehicleId): void => {
  if (vehicleId === 'sedan') {
    applySedanVariant(root);
    return;
  }
  if (vehicleId === 'pickup') {
    applyPickupVariant(root);
  }
};

/** Локальные позиции прожекторов ночи */
export const headlightLocalPositions = (
  vehicleId: TVehicleId,
): { left: [number, number, number]; right: [number, number, number] } => {
  if (vehicleId === 'sedan') {
    return {
      left: [-0.6, 0.44, 1.58],
      right: [0.6, 0.44, 1.58],
    };
  }
  if (vehicleId === 'pickup') {
    return {
      left: [-0.62, 0.52, 1.52],
      right: [0.62, 0.52, 1.52],
    };
  }
  return {
    left: [-0.58, 0.48, 1.55],
    right: [0.58, 0.48, 1.55],
  };
};

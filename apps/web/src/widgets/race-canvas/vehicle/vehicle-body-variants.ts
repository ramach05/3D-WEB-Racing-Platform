import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  CylinderGeometry,
  TorusGeometry,
  Vector3,
  Vector4,
  type SkinnedMesh,
  type Material,
  type Object3D,
} from 'three';
import type { TVehicleId } from '@/entities/vehicle';
import { vehiclePalette } from '@/shared/config';
import type { TVehicleFit } from '@/widgets/race-canvas/vehicle/vehicle-fit';
import {
  measureWheelAxle,
  sampleWheelWorldPoints,
} from '@/widgets/race-canvas/vehicle/vehicle-wheel-rig';

/**
 * Bust useMemo clone cache when normalize logic changes (HMR).
 * Bump when shipping visual fixes for garage bodies.
 */
export const VEHICLE_VARIANT_REV = 76;

const WHEEL_PIVOT_NAMES = ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR'] as const;
type TWheelPivotName = (typeof WHEEL_PIVOT_NAMES)[number];

const PICKUP_WHEEL_NODE_NAMES = ['polySurface1', 'polySurface8441'] as const;
const PICKUP_CALIPER_NODE_NAMES = ['polySurface9497', 'polySurface9559'] as const;

/** Logan (Sketchfab «Renault Logan 2004»): базовый синий цвет кузова */
export const SEDAN_BODY_COLOR = 0x1660c8;

/** Панели кузова Logan, которые красим в синий (не пластик/шины/свет; бамперы в атласе давали красный низ) */
const SEDAN_BODY_PANEL_PATTERN =
  /^(Kuzov_low|Kuzov_Bak_low|Kapot_low|Dver_1_low|Dver_2_low|Bagajnik_low|Bamper_(?:pered|zad)_[0-9]_low)_/i;

/**
 * Logan: светильники делят общий атлас-материал Kuzov1 с кузовом,
 * поэтому сплим-клоним их по имени меша на контрактные имена.
 */
const SEDAN_LIGHT_RULES = [
  { pattern: /^Fara_1_low_/i, materialName: 'Headlight' },
  { pattern: /^Fara_2_low_/i, materialName: 'Headlight' },
  { pattern: /^Fara_lamp_low_/i, materialName: 'Headlight' },
  { pattern: /^Protivotumanki_low_/i, materialName: 'Headlight' },
  { pattern: /^Fonar_low_/i, materialName: 'Brakelight' },
  { pattern: /^Povorotnik_low_/i, materialName: 'Signallight' },
] as const;

/** Logan: combined-меши колёс (все 4 колеса в одном меше) */
const SEDAN_WHEEL_MESH_NAMES = ['Rezina_low_Kuzov1_0', 'Disk_low_Kuzov1_0'] as const;

const JUKE_WHEEL_MATERIAL_NAMES = new Set(['wheel1', 'wheel2', 'wheel3']);
/** Combined juke wheel layers span ~full track width — hide them when using compact wheels */
const JUKE_COMBINED_WHEEL_XZ_SPAN = 1.2;
/**
 * Sketchfab: чёрная резина Matte__FF2 лежит отдельно от металлических дисков wheel1.
 * Без привязки к пивоту резина не крутится → «два колеса»; без неё остаются голые диски.
 */
const JUKE_TIRE_MATERIAL = 'Matte__FF2';
/** Высота покрышки/диска тормоза (м) */
const JUKE_TIRE_Y_MIN = 0.35;
const JUKE_TIRE_Y_MAX = 0.8;


const SCIROCCO_WHEEL_MATERIAL_NAMES = new Set(['wheel.001', 'tire', 'rotor1', 'rotor0']);

const tmpBox = new Box3();
const tmpCenter = new Vector3();
const tmpSize = new Vector3();
const tmpA = new Vector3();
const tmpB = new Vector3();
const tmpC = new Vector3();
const tmpBakePos = new Vector3();
const tmpBakeAcc = new Vector3();
const tmpBakeBone = new Vector3();
const tmpBakeMat = new Matrix4();
const tmpParentInv = new Matrix4();
const tmpSkinIndex = new Vector4();
const tmpSkinWeight = new Vector4();

const isMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true;

const isSkinnedMesh = (object: Object3D): object is SkinnedMesh =>
  (object as SkinnedMesh).isSkinnedMesh === true;

const isStandardMaterial = (material: Material): material is MeshStandardMaterial =>
  (material as MeshStandardMaterial).isMeshStandardMaterial === true;

/**
 * Мировая позиция вершины SkinnedMesh как при AttachedBindMode:
 * Σ (bone.matrixWorld · boneInverse · bindMatrix · v) · weight.
 * Не зависит от bindMode/matrixWorld меша — только кости + bindMatrix.
 */
const skinnedVertexWorld = (skinned: SkinnedMesh, index: number, target: Vector3): Vector3 => {
  const { geometry, skeleton, bindMatrix } = skinned;
  const position = geometry.getAttribute('position');
  const skinIndex = geometry.getAttribute('skinIndex');
  const skinWeight = geometry.getAttribute('skinWeight');
  tmpBakePos.fromBufferAttribute(position, index).applyMatrix4(bindMatrix);
  tmpBakeAcc.set(0, 0, 0);
  if (!skinIndex || !skinWeight) {
    return target.copy(tmpBakePos);
  }
  tmpSkinIndex.fromBufferAttribute(skinIndex as BufferAttribute, index);
  tmpSkinWeight.fromBufferAttribute(skinWeight as BufferAttribute, index);
  for (let k = 0; k < 4; k += 1) {
    const weight = tmpSkinWeight.getComponent(k);
    if (weight === 0) {
      continue;
    }
    const boneIndex = tmpSkinIndex.getComponent(k);
    const bone = skeleton.bones[boneIndex];
    const boneInverse = skeleton.boneInverses[boneIndex];
    if (!bone || !boneInverse) {
      continue;
    }
    tmpBakeMat.multiplyMatrices(bone.matrixWorld, boneInverse);
    tmpBakeBone.copy(tmpBakePos).applyMatrix4(tmpBakeMat);
    tmpBakeAcc.addScaledVector(tmpBakeBone, weight);
  }
  return target.copy(tmpBakeAcc);
};

/**
 * Запекает wheel-SkinnedMesh в обычный Mesh в видимой (bone-skinned) позе.
 * Иначе measureWheelAxle/spin крутят сырую bind-геометрию мимо реальной оси шины.
 */
const bakeSkinnedWheelMesh = (skinned: SkinnedMesh): Mesh | null => {
  const parent = skinned.parent;
  if (!parent) {
    return null;
  }

  const geometry = skinned.geometry.clone();
  const position = geometry.getAttribute('position');
  tmpParentInv.copy(parent.matrixWorld).invert();

  for (let i = 0; i < position.count; i += 1) {
    skinnedVertexWorld(skinned, i, tmpBakePos);
    tmpBakePos.applyMatrix4(tmpParentInv);
    position.setXYZ(i, tmpBakePos.x, tmpBakePos.y, tmpBakePos.z);
  }
  position.needsUpdate = true;
  geometry.deleteAttribute('skinIndex');
  geometry.deleteAttribute('skinWeight');
  // clone() копирует stale boundingBox из bind-позы — иначе пивоты/spin уезжают
  geometry.boundingBox = null;
  geometry.boundingSphere = null;
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();

  const mesh = new Mesh(geometry, skinned.material);
  mesh.name = skinned.name;
  mesh.castShadow = skinned.castShadow;
  mesh.receiveShadow = skinned.receiveShadow;
  mesh.visible = skinned.visible;
  mesh.position.set(0, 0, 0);
  mesh.quaternion.identity();
  mesh.scale.set(1, 1, 1);

  const index = parent.children.indexOf(skinned);
  parent.remove(skinned);
  parent.add(mesh);
  if (index >= 0) {
    parent.children.splice(parent.children.indexOf(mesh), 1);
    parent.children.splice(index, 0, mesh);
    mesh.parent = parent;
  }
  return mesh;
};

/** Scirocco: запекает tire/rim/rotor SkinnedMesh до сборки пивотов. */
const bakeSciroccoWheelSkinnedMeshes = (root: Object3D): void => {
  root.updateMatrixWorld(true);
  const toBake: SkinnedMesh[] = [];
  root.traverse((object) => {
    if (!isSkinnedMesh(object)) {
      return;
    }
    if (meshMaterialNames(object).some((name) => SCIROCCO_WHEEL_MATERIAL_NAMES.has(name))) {
      toBake.push(object);
    }
  });
  for (const skinned of toBake) {
    bakeSkinnedWheelMesh(skinned);
  }
  root.updateMatrixWorld(true);
};

/** Переименовывает материалы по точному имени (все вхождения в дереве) */
const renameMaterials = (root: Object3D, from: string, to: string) => {
  root.traverse((object) => {
    if (!isMesh(object)) {
      return;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (isStandardMaterial(material) && material.name === from) {
        material.name = to;
      }
    }
  });
};

/**
 * Authored light-материалы часто metalness≈1 — ночью зеркалят тьму.
 * Снижаем metalness у Headlight / Brakelight / Signallight, чтобы emissive читался.
 * Brakelight/Signallight — глянцевый поликарбонат линзы; Headlight — выкл. по умолчанию.
 */
const prepareEmissiveLightMaterials = (root: Object3D): void => {
  root.traverse((object) => {
    if (!isMesh(object)) {
      return;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!isStandardMaterial(material)) {
        continue;
      }
      if (
        material.name !== 'Headlight' &&
        material.name !== 'Brakelight' &&
        material.name !== 'Signallight'
      ) {
        continue;
      }
      if (material.name === 'Brakelight') {
        // Глянцевая линза: низкий roughness даёт блики вместо плоской «краски»
        material.color.set(vehiclePalette.brakeGlass);
        material.map = null;
        material.metalness = 0.12;
        material.roughness = 0.2;
        material.envMapIntensity = 1.35;
        material.emissive.set(vehiclePalette.brakeEmissive);
        material.emissiveMap = null;
        material.emissiveIntensity = 0;
        material.needsUpdate = true;
      } else if (material.name === 'Signallight') {
        material.color.set(vehiclePalette.signalGlass);
        material.map = null;
        material.metalness = 0.12;
        material.roughness = 0.22;
        material.envMapIntensity = 1.25;
        material.emissive.set('#000000');
        material.emissiveIntensity = 0;
        material.needsUpdate = true;
      } else {
        material.metalness = Math.min(material.metalness, 0.2);
        material.roughness = Math.max(material.roughness, 0.35);
        material.emissive.set('#000000');
        material.emissiveIntensity = 0;
        material.needsUpdate = true;
      }
    }
  });
};

const meshMaterialNames = (mesh: Mesh): string[] => {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.map((material) => material.name);
};

const worldCenterOf = (object: Object3D): Vector3 => {
  tmpBox.setFromObject(object);
  return tmpBox.getCenter(tmpCenter).clone();
};

const quadrantName = (x: number, z: number, midX: number, midZ: number): TWheelPivotName => {
  const isFront = z >= midZ;
  const isLeft = x >= midX;
  if (isFront) {
    return isLeft ? 'WheelFrontL' : 'WheelFrontR';
  }
  return isLeft ? 'WheelRearL' : 'WheelRearR';
};

/**
 * Строит новый Mesh из выбранных треугольников исходного меша (переиндексация атрибутов).
 * Геометрия остаётся в local space исходного меша, transform копируется 1-в-1.
 */
const sliceMeshTriangles = (mesh: Mesh, triIndices: number[], suffix: string): Mesh | null => {
  if (triIndices.length === 0) {
    return null;
  }
  const geometry = mesh.geometry;
  const remapped = new Map<number, number>();
  const newIndices: number[] = [];
  const attrArrays: Record<string, number[]> = {};
  for (const attrName of Object.keys(geometry.attributes)) {
    attrArrays[attrName] = [];
  }

  for (const oldIndex of triIndices) {
    let next = remapped.get(oldIndex);
    if (next === undefined) {
      next = remapped.size;
      remapped.set(oldIndex, next);
      for (const attrName of Object.keys(geometry.attributes)) {
        const attribute = geometry.getAttribute(attrName);
        const itemSize = attribute.itemSize;
        const dest = attrArrays[attrName]!;
        for (let c = 0; c < itemSize; c += 1) {
          dest.push(attribute.getComponent(oldIndex, c));
        }
      }
    }
    newIndices.push(next);
  }

  const sliced = new BufferGeometry();
  for (const attrName of Object.keys(attrArrays)) {
    const attribute = geometry.getAttribute(attrName);
    sliced.setAttribute(
      attrName,
      new BufferAttribute(new Float32Array(attrArrays[attrName]!), attribute.itemSize),
    );
  }
  sliced.setIndex(newIndices);
  sliced.computeBoundingBox();
  sliced.computeBoundingSphere();

  const part = new Mesh(sliced, mesh.material);
  part.name = `${mesh.name || 'wheel'}_${suffix}`;
  part.position.copy(mesh.position);
  part.quaternion.copy(mesh.quaternion);
  part.scale.copy(mesh.scale);
  part.castShadow = mesh.castShadow;
  part.receiveShadow = mesh.receiveShadow;
  return part;
};

/**
 * Режет один меш «все 4 колеса» на до 4 мешей по квадрантам XZ (по центроиду треугольника).
 * Геометрия остаётся в local space исходного меша.
 */
const splitMeshByXzQuadrants = (
  mesh: Mesh,
  midX: number,
  midZ: number,
): Partial<Record<TWheelPivotName, Mesh>> => {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  if (!position) {
    return {};
  }

  mesh.updateMatrixWorld(true);
  const index = geometry.getIndex();
  const triCount = index ? index.count / 3 : position.count / 3;
  const buckets: Record<TWheelPivotName, number[]> = {
    WheelFrontL: [],
    WheelFrontR: [],
    WheelRearL: [],
    WheelRearR: [],
  };

  for (let tri = 0; tri < triCount; tri += 1) {
    const i0 = index ? index.getX(tri * 3) : tri * 3;
    const i1 = index ? index.getX(tri * 3 + 1) : tri * 3 + 1;
    const i2 = index ? index.getX(tri * 3 + 2) : tri * 3 + 2;

    tmpA.fromBufferAttribute(position, i0).applyMatrix4(mesh.matrixWorld);
    tmpB.fromBufferAttribute(position, i1).applyMatrix4(mesh.matrixWorld);
    tmpC.fromBufferAttribute(position, i2).applyMatrix4(mesh.matrixWorld);

    const cx = (tmpA.x + tmpB.x + tmpC.x) / 3;
    const cz = (tmpA.z + tmpB.z + tmpC.z) / 3;
    buckets[quadrantName(cx, cz, midX, midZ)].push(i0, i1, i2);
  }

  const result: Partial<Record<TWheelPivotName, Mesh>> = {};
  for (const name of WHEEL_PIVOT_NAMES) {
    const triIndices = buckets[name];
    if (triIndices.length === 0) {
      continue;
    }

    const part = sliceMeshTriangles(mesh, triIndices, name);
    if (part) {
      result[name] = part;
    }
  }

  return result;
};

/** Собирает меши под нодой (сама нода, если Mesh) */
const collectMeshesUnder = (node: Object3D): Mesh[] => {
  const meshes: Mesh[] = [];
  if (isMesh(node)) {
    meshes.push(node);
  }
  node.traverse((object) => {
    if (object !== node && isMesh(object)) {
      meshes.push(object);
    }
  });
  return meshes;
};

const createEmptyPivots = (root: Object3D): Record<TWheelPivotName, Group> => {
  const pivots: Record<TWheelPivotName, Group> = {
    WheelFrontL: new Group(),
    WheelFrontR: new Group(),
    WheelRearL: new Group(),
    WheelRearR: new Group(),
  };
  for (const name of WHEEL_PIVOT_NAMES) {
    pivots[name].name = name;
    root.add(pivots[name]);
  }
  return pivots;
};

/** Центрирует пивоты по bbox детей (local parent = root) */
const recenterPivots = (root: Object3D, pivots: Record<TWheelPivotName, Group>): void => {
  root.updateMatrixWorld(true);
  for (const name of WHEEL_PIVOT_NAMES) {
    const pivot = pivots[name];
    if (pivot.children.length === 0) {
      pivot.removeFromParent();
      continue;
    }
    const center = worldCenterOf(pivot);
    root.worldToLocal(center);
    const children = [...pivot.children];
    for (const child of children) {
      root.attach(child);
    }
    pivot.position.copy(center);
    pivot.updateMatrixWorld(true);
    for (const child of children) {
      pivot.attach(child);
    }
  }
};

/**
 * Делит combined wheel-меши на 4 пивота; исходные меши удаляет.
 * midX/midZ — центр кузова в world (обычно ~0).
 */
const buildWheelPivotsFromCombinedMeshes = (
  root: Object3D,
  sourceMeshes: Mesh[],
  midX: number,
  midZ: number,
): void => {
  if (sourceMeshes.length === 0) {
    return;
  }

  root.updateMatrixWorld(true);
  const pivots = createEmptyPivots(root);

  for (const mesh of sourceMeshes) {
    const parts = splitMeshByXzQuadrants(mesh, midX, midZ);
    const parent = mesh.parent;

    for (const name of WHEEL_PIVOT_NAMES) {
      const part = parts[name];
      if (!part || !parent) {
        continue;
      }
      parent.add(part);
      part.updateMatrixWorld(true);
      pivots[name].attach(part);
    }

    mesh.removeFromParent();
  }

  recenterPivots(root, pivots);
};

/**
 * Вешает уже отдельные сборки колёс (группы/меши) на 4 пивота по world-квадранту.
 */
const buildWheelPivotsFromAssemblies = (
  root: Object3D,
  assemblies: Object3D[],
  midX: number,
  midZ: number,
): void => {
  if (assemblies.length === 0) {
    return;
  }

  root.updateMatrixWorld(true);
  const pivots = createEmptyPivots(root);

  for (const assembly of assemblies) {
    const center = worldCenterOf(assembly);
    const name = quadrantName(center.x, center.z, midX, midZ);
    pivots[name].attach(assembly);
  }

  recenterPivots(root, pivots);
};

/** Пустые зеркальные пивоты для отсутствующих задних колёс (симметрия rig) */
const ensureMissingWheelPivots = (root: Object3D): void => {
  const frontL = root.getObjectByName('WheelFrontL');
  const frontR = root.getObjectByName('WheelFrontR');
  const rearL = root.getObjectByName('WheelRearL');
  const rearR = root.getObjectByName('WheelRearR');

  if (!rearL && frontL?.parent) {
    const mirror = new Group();
    mirror.name = 'WheelRearL';
    mirror.position.set(frontL.position.x, frontL.position.y, -Math.abs(frontL.position.z));
    frontL.parent.add(mirror);
  }
  if (!rearR && frontR?.parent) {
    const mirror = new Group();
    mirror.name = 'WheelRearR';
    mirror.position.set(frontR.position.x, frontR.position.y, -Math.abs(frontR.position.z));
    frontR.parent.add(mirror);
  }
};

/**
 * Физика едет вдоль +Z. Если фары сзади стопов — крутим кузов на 180°,
 * чтобы нос смотрел вперёд (колёса вешаем уже после этого).
 */
const ensureNoseTowardPlusZ = (root: Object3D): void => {
  root.updateMatrixWorld(true);
  const headZs: number[] = [];
  const brakeZs: number[] = [];
  root.traverse((object) => {
    if (!isMesh(object)) {
      return;
    }
    const names = meshMaterialNames(object);
    const isHead = names.some((name) => name === 'Headlight');
    const isBrake = names.some((name) => name === 'Brakelight');
    if (!isHead && !isBrake) {
      return;
    }
    tmpBox.setFromObject(object);
    const z = tmpBox.getCenter(tmpCenter).z;
    if (isHead) {
      headZs.push(z);
    }
    if (isBrake) {
      brakeZs.push(z);
    }
  });
  if (headZs.length === 0 || brakeZs.length === 0) {
    return;
  }
  const headAvg = headZs.reduce((sum, z) => sum + z, 0) / headZs.length;
  const brakeAvg = brakeZs.reduce((sum, z) => sum + z, 0) / brakeZs.length;
  if (headAvg >= brakeAvg) {
    return;
  }
  root.rotation.y += Math.PI;
  root.updateMatrixWorld(true);
};

/** Logan: клонит материалы световых мешей на контрактные имена Headlight/... */
const splitSedanMeshesByLightRule = (root: Object3D): void => {
  root.traverse((object) => {
    if (!isMesh(object)) {
      return;
    }
    const rule = SEDAN_LIGHT_RULES.find((item) => item.pattern.test(object.name));
    if (!rule) {
      return;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const renamed = materials.map((material): Material => {
      if (!isStandardMaterial(material)) {
        return material;
      }
      const clone = material.clone();
      clone.name = rule.materialName;
      // Атлас Kuzov1 затемняет линзы — цвет задаёт prepareEmissiveLightMaterials
      clone.map = null;
      return clone;
    });
    const next = Array.isArray(object.material) ? renamed : renamed[0];
    if (next) {
      object.material = next;
    }
  });
};

/** Logan: красит панели кузова и бамперы в синий, отвязав их от атласа-текстуры */
const paintSedanBodyBlue = (root: Object3D): void => {
  root.traverse((object) => {
    if (!isMesh(object)) {
      return;
    }
    if (!SEDAN_BODY_PANEL_PATTERN.test(object.name)) {
      return;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const painted = materials.map((material): Material => {
      if (!isStandardMaterial(material)) {
        return material;
      }
      const clone = material.clone();
      clone.name = 'SedanBodyPaint';
      clone.color.setHex(SEDAN_BODY_COLOR);
      clone.map = null;
      clone.needsUpdate = true;
      return clone;
    });
    const next = Array.isArray(object.material) ? painted : painted[0];
    if (next) {
      object.material = next;
    }
  });
};

/**
 * Logan (Sketchfab «Renault Logan 2004»): один атлас-материал Kuzov1 на кузов,
 * светильники — отдельные меши по имени. Картируем их на контракт, красим
 * панели и бамперы в синий, combined-колёса (Rezina/Disk) режем на 4 пивота как у пикапа.
 */
const normalizeSedan = (root: Object3D) => {
  splitSedanMeshesByLightRule(root);
  prepareEmissiveLightMaterials(root);
  paintSedanBodyBlue(root);
  // Logan authored носом в −Z? Выравниваем под контракт гонки (+Z), если нужно
  ensureNoseTowardPlusZ(root);

  root.updateMatrixWorld(true);
  const bodyBox = tmpBox.setFromObject(root);
  const mid = bodyBox.getCenter(tmpCenter);

  const sourceMeshes: Mesh[] = [];
  for (const name of SEDAN_WHEEL_MESH_NAMES) {
    const node = root.getObjectByName(name);
    if (node) {
      sourceMeshes.push(...collectMeshesUnder(node));
    }
  }

  buildWheelPivotsFromCombinedMeshes(root, sourceMeshes, mid.x, mid.z);
  ensureMissingWheelPivots(root);
};

/** Пикап: бордовый кузов вместо authored-синего из GLB, не сливается с Logan */
export const PICKUP_BODY_COLOR = 0x71121f;

/**
 * Клонируем paint-материал (как у седана), чтобы не закрасить оригинал
 * GLB-сцены; roughness — глянец автолака вместо authored-матового 0.96,
 * metalness не трогаем: без envMap металл в сцене чернеет.
 */
const paintPickupBodyBurgundy = (root: Object3D): void => {
  root.traverse((object) => {
    if (!isMesh(object)) {
      return;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const painted = materials.map((material): Material => {
      if (!isStandardMaterial(material) || material.name !== 'RAM_1500TRX_2021Paint_Material') {
        return material;
      }
      const clone = material.clone();
      clone.name = 'PickupBodyPaint';
      clone.color.setHex(PICKUP_BODY_COLOR);
      clone.roughness = 0.32;
      clone.needsUpdate = true;
      return clone;
    });
    object.material = painted.length === 1 ? painted[0]! : painted;
  });
};

const normalizePickup = (root: Object3D) => {
  renameMaterials(root, 'RAM_1500TRX_2021LightA_Material', 'Headlight');
  renameMaterials(root, 'RED_GLASS', 'Brakelight');
  renameMaterials(root, 'ORANGE_GLASS', 'Signallight');
  prepareEmissiveLightMaterials(root);
  paintPickupBodyBurgundy(root);
  root.updateMatrixWorld(true);
  const bodyBox = tmpBox.setFromObject(root);
  const mid = bodyBox.getCenter(tmpCenter);

  const sourceMeshes: Mesh[] = [];
  for (const name of [...PICKUP_WHEEL_NODE_NAMES, ...PICKUP_CALIPER_NODE_NAMES]) {
    const node = root.getObjectByName(name);
    if (!node) {
      continue;
    }
    sourceMeshes.push(...collectMeshesUnder(node));
  }

  buildWheelPivotsFromCombinedMeshes(root, sourceMeshes, mid.x, mid.z);
  ensureMissingWheelPivots(root);
};

/** Juke (Sketchfab «материалмержен»): стекло фар и задних фонарей — один меш glass6 */
const JUKE_GLASS6_MATERIAL = 'glass6';
/** Если кластеры света в мировом Z разнесены меньше этой дистанции — не режем */
const JUKE_GLASS_SPLIT_MIN_GAP = 0.4;

/** Мировые Z центроидов треугольников меша (для кластеризации носа/кормы) */
const triangleWorldCentroidZs = (mesh: Mesh): number[] => {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  if (!position) {
    return [];
  }
  mesh.updateMatrixWorld(true);
  const index = geometry.getIndex();
  const triCount = index ? index.count / 3 : position.count / 3;
  const zs: number[] = [];
  for (let tri = 0; tri < triCount; tri += 1) {
    const i0 = index ? index.getX(tri * 3) : tri * 3;
    const i1 = index ? index.getX(tri * 3 + 1) : tri * 3 + 1;
    const i2 = index ? index.getX(tri * 3 + 2) : tri * 3 + 2;
    tmpA.fromBufferAttribute(position, i0).applyMatrix4(mesh.matrixWorld);
    tmpB.fromBufferAttribute(position, i1).applyMatrix4(mesh.matrixWorld);
    tmpC.fromBufferAttribute(position, i2).applyMatrix4(mesh.matrixWorld);
    zs.push((tmpA.z + tmpB.z + tmpC.z) / 3);
  }
  return zs;
};

/** Середина наибольшего зазора между отсортированными мировыми Z (граница кластеров) */
const largestGapBoundary = (sorted: number[], minGap: number): number | null => {
  let boundary = 0;
  let gap = -1;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev === undefined || curr === undefined) {
      continue;
    }
    const d = curr - prev;
    if (d > gap) {
      gap = d;
      boundary = (curr + prev) / 2;
    }
  }
  return gap >= minGap ? boundary : null;
};

/** Возвращает две части меша: low (world z < splitZ) и high (world z >= splitZ) */
const splitMeshByWorldZ = (mesh: Mesh, splitZ: number): { low: Mesh | null; high: Mesh | null } => {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  if (!position) {
    return { low: null, high: null };
  }
  mesh.updateMatrixWorld(true);
  const index = geometry.getIndex();
  const triCount = index ? index.count / 3 : position.count / 3;
  const low: number[] = [];
  const high: number[] = [];
  for (let tri = 0; tri < triCount; tri += 1) {
    const i0 = index ? index.getX(tri * 3) : tri * 3;
    const i1 = index ? index.getX(tri * 3 + 1) : tri * 3 + 1;
    const i2 = index ? index.getX(tri * 3 + 2) : tri * 3 + 2;
    tmpA.fromBufferAttribute(position, i0).applyMatrix4(mesh.matrixWorld);
    tmpB.fromBufferAttribute(position, i1).applyMatrix4(mesh.matrixWorld);
    tmpC.fromBufferAttribute(position, i2).applyMatrix4(mesh.matrixWorld);
    const cz = (tmpA.z + tmpB.z + tmpC.z) / 3;
    if (cz < splitZ) {
      low.push(i0, i1, i2);
    } else {
      high.push(i0, i1, i2);
    }
  }
  return {
    low: sliceMeshTriangles(mesh, low, 'Rear'),
    high: sliceMeshTriangles(mesh, high, 'Front'),
  };
};

/** Клонирует материал(ы) меша под роль Headlight/Brakelight */
const relabelMeshMaterial = (mesh: Mesh, role: string): void => {
  const relabel = (material: Material): Material => {
    if (!isStandardMaterial(material)) {
      return material;
    }
    const clone = material.clone();
    clone.name = role;
    return clone;
  };
  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map(relabel);
    return;
  }
  mesh.material = relabel(mesh.material);
};

/**
 * Juke: материал glass6 — один слитый меш, где и стекло фар (нос, +Z),
 * и стекло задних фонарей (корма, −Z). Режем по наибольшему мировому Z-зазору:
 * перед → Headlight, зад → Brakelight, чтобы задние фонари не светили жёлтым
 * (как фары), а горели красным вместе с material_15.
 */
const splitJukeGlass6 = (root: Object3D): void => {
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!isMesh(object)) {
      return;
    }
    if (!meshMaterialNames(object).includes(JUKE_GLASS6_MATERIAL)) {
      return;
    }
    const parent = object.parent;
    if (!parent) {
      return;
    }
    const boundary = largestGapBoundary(
      triangleWorldCentroidZs(object).sort((a, b) => a - b),
      JUKE_GLASS_SPLIT_MIN_GAP,
    );
    if (boundary === null) {
      return; // один кластер — оставляем как есть (фолбэк прежнего поведения)
    }
    const { low, high } = splitMeshByWorldZ(object, boundary);
    if (high) {
      high.name = `${object.name}_Headlight`;
      relabelMeshMaterial(high, 'Headlight');
      parent.add(high);
    }
    if (low) {
      low.name = `${object.name}_Brakelight`;
      relabelMeshMaterial(low, 'Brakelight');
      parent.add(low);
    }
    object.removeFromParent();
  });
};

/**
 * Authored Matte__FF2 — слитые поперек оси «протекторы» meshmerger'а: лохматые
 * слэбы 0.44–0.58 м (втрое шире колеса), их локусмы при рулении торчат
 * лопастями за габарит шины — прячем. Длинные вдоль базы шеллы (z ≥ 1.2 м) —
 * не днище: в juke.glb это резина всех 4 колес в одном меше, их режет на куски
 * и вешает на пивоты attachJukeTiresToRimPose.
 */
const hideJukeTreadSlabs = (root: Object3D): void => {
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!isMesh(object) || !object.visible) {
      return;
    }
    if (!meshMaterialNames(object).includes(JUKE_TIRE_MATERIAL)) {
      return;
    }
    tmpBox.setFromObject(object);
    tmpBox.getSize(tmpSize);
    if (tmpSize.y < JUKE_TIRE_Y_MIN || tmpSize.y > JUKE_TIRE_Y_MAX) {
      return;
    }
    if (tmpSize.z >= JUKE_COMBINED_WHEEL_XZ_SPAN) {
      return;
    }
    if (tmpSize.x >= JUKE_COMBINED_WHEEL_XZ_SPAN) {
      object.visible = false;
    }
  });
};

const JUKE_WORLD_UP = new Vector3(0, 1, 0);
const tmpJukeWorld = new Matrix4();
const tmpJukeRot = new Matrix4();
const tmpJukeLocal = new Matrix4();

/** Поворот объекта в мире вокруг мировой точки point (ось axis через нее). */
const rotateAroundWorldPoint = (
  object: Object3D,
  axis: Vector3,
  angle: number,
  point: Vector3,
): void => {
  object.updateWorldMatrix(true, false);
  tmpJukeWorld.makeTranslation(point.x, point.y, point.z);
  tmpJukeLocal.makeTranslation(-point.x, -point.y, -point.z);
  tmpJukeRot.makeRotationAxis(axis, angle);
  tmpJukeWorld.multiply(tmpJukeRot).multiply(tmpJukeLocal).multiply(object.matrixWorld);
  if (object.parent) {
    tmpJukeRot.copy(object.parent.matrixWorld).invert();
    tmpJukeLocal.copy(tmpJukeRot).multiply(tmpJukeWorld);
  } else {
    tmpJukeLocal.copy(tmpJukeWorld);
  }
  tmpJukeLocal.decompose(object.position, object.quaternion, object.scale);
};

/** Радиус околоколесного куска шелла: вершины дальше от центра колеса — часть «моста». */
const JUKE_TIRE_SHELL_PROXIMITY = 0.55;

/**
 * Раскладывает треугольники слитого шелла покрышки по колесам: треугольник
 * попадает в корзину w, только если все 3 его мировых вершины вблизи центра
 * колеса w. «Мосты» meshmerger'а между колесами отбрасываются — на пивоте они
 * дали бы лопасти, торчащие за габарит шины. Формат корзин — плоские тройки
 * индексов вершин, как ожидает sliceMeshTriangles.
 */
const bucketShellTrianglesByWheel = (
  mesh: Mesh,
  centers: readonly Vector3[],
  proximity: number,
): number[][] => {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  if (!position) {
    return centers.map(() => []);
  }
  mesh.updateMatrixWorld(true);
  const index = geometry.getIndex();
  const triCount = index ? index.count / 3 : position.count / 3;
  const buckets: number[][] = centers.map(() => []);
  const proximitySq = proximity * proximity;
  const isNear = (vertexIndex: number, center: Vector3): boolean => {
    tmpA.fromBufferAttribute(position, vertexIndex).applyMatrix4(mesh.matrixWorld);
    return tmpA.distanceToSquared(center) <= proximitySq;
  };
  for (let tri = 0; tri < triCount; tri += 1) {
    const i0 = index ? index.getX(tri * 3) : tri * 3;
    const i1 = index ? index.getX(tri * 3 + 1) : tri * 3 + 1;
    const i2 = index ? index.getX(tri * 3 + 2) : tri * 3 + 2;
    for (let w = 0; w < centers.length; w += 1) {
      const center = centers[w] as Vector3;
      if (isNear(i0, center) && isNear(i1, center) && isNear(i2, center)) {
        (buckets[w] as number[]).push(i0, i1, i2);
        break;
      }
    }
  }
  return buckets;
};

/**
 * Шины Matte__FF2 на пивоты — ДО buildWheelRig (см. prepareVehicleRoot):
 * authored-поза резины согласована с baked-toe дисков (~20°) на заводе, поэтому
 * достаточно attach без доворотов — align/steer/spin крутят диск и резину единым
 * узлом. Для компактных боковин оставляем defensive delta: доворот до bearing
 * диска, измеренного в ТОМ ЖЕ фрейме (до align он 0; вызов после rig не ломается).
 * Слитые meshmerger-шеллы режем на околоколесные куски: у осколков скан bearing
 * ненадежен, поэтому они сохраняют authored-позу 1-в-1 относительно диска.
 */
export const attachJukeTiresToRimPose = (root: Object3D): void => {
  root.updateMatrixWorld(true);
  const pivotGroups = {} as Partial<Record<TWheelPivotName, Group>>;
  for (const name of WHEEL_PIVOT_NAMES) {
    const pivot = root.getObjectByName(name);
    if (
      pivot
      && (pivot as Group).isGroup === true
      && !pivotHasAuthoredTire(pivot as Group)
    ) {
      pivotGroups[name] = pivot as Group;
    }
  }
  const pivots = Object.values(pivotGroups) as Group[];
  if (pivots.length === 0) {
    return;
  }

  const rimBearing = new Map<Group, number>();
  for (const pivot of pivots) {
    const axle = measureWheelAxle(pivot);
    rimBearing.set(pivot, Math.atan2(axle.z, axle.x));
  }

  const pivotCenters = pivots.map((pivot) => {
    tmpBox.setFromObject(pivot);
    return tmpBox.getCenter(tmpCenter).clone();
  });

  const tires: Mesh[] = [];
  root.traverse((object) => {
    if (!isMesh(object) || !object.visible) {
      return;
    }
    if (!meshMaterialNames(object).includes(JUKE_TIRE_MATERIAL)) {
      return;
    }
    if (object.name.endsWith('_TireFill')) {
      return;
    }
    tmpBox.setFromObject(object);
    tmpBox.getSize(tmpSize);
    if (tmpSize.y < JUKE_TIRE_Y_MIN || tmpSize.y > JUKE_TIRE_Y_MAX) {
      return;
    }
    if (tmpSize.x >= JUKE_COMBINED_WHEEL_XZ_SPAN || tmpSize.z >= JUKE_COMBINED_WHEEL_XZ_SPAN) {
      return;
    }
    let node: Object3D | null = object.parent;
    while (node) {
      if ((WHEEL_PIVOT_NAMES as readonly string[]).includes(node.name)) {
        return;
      }
      node = node.parent;
    }
    tires.push(object);
  });

  for (const tire of tires) {
    tmpBox.setFromObject(tire);
    const center = tmpBox.getCenter(tmpCenter).clone();
    let bestPivot = pivots[0] as Group;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < pivots.length; i += 1) {
      const d = center.distanceToSquared(pivotCenters[i] as Vector3);
      if (d < bestDist) {
        bestDist = d;
        bestPivot = pivots[i] as Group;
      }
    }
    // Поворот вокруг Y на θ меняет bearing b в b−θ ⇒ θ = bT − bR.
    const tireAxle = measureWheelAxle(tire);
    const delta = Math.atan2(tireAxle.z, tireAxle.x) - (rimBearing.get(bestPivot) ?? 0);
    if (Math.abs(delta) > 1e-4) {
      rotateAroundWorldPoint(tire, JUKE_WORLD_UP, delta, center);
      tire.updateWorldMatrix(true, false);
    }
    bestPivot.attach(tire);
  }

  // Слитые meshmerger'ом шеллы покрышек: один меш на несколько колес (bbox ≥ 1.2 м)
  // не проходит компактный фильтр выше, а hideJukeTreadSlabs его не прячет (z ≥ 1.2
  // считался «днищем»). Итог — статичная «покрышка» с запеченным toe передних колес
  // поверх рулящего диска. Режем такой шелл на околоколесные куски и вешаем каждый
  // на свой пивот в bearing диска; оригинал удаляем (мосты между колесами отбрасаны).
  const shells: Mesh[] = [];
  root.traverse((object) => {
    if (!isMesh(object) || !object.visible) {
      return;
    }
    if (!meshMaterialNames(object).includes(JUKE_TIRE_MATERIAL)) {
      return;
    }
    if (object.name.endsWith('_TireFill')) {
      return;
    }
    tmpBox.setFromObject(object);
    tmpBox.getSize(tmpSize);
    if (tmpSize.y < JUKE_TIRE_Y_MIN || tmpSize.y > JUKE_TIRE_Y_MAX) {
      return;
    }
    if (tmpSize.x < JUKE_COMBINED_WHEEL_XZ_SPAN && tmpSize.z < JUKE_COMBINED_WHEEL_XZ_SPAN) {
      return;
    }
    let node: Object3D | null = object.parent;
    while (node) {
      if ((WHEEL_PIVOT_NAMES as readonly string[]).includes(node.name)) {
        return;
      }
      node = node.parent;
    }
    shells.push(object);
  });

  for (const shell of shells) {
    const parent = shell.parent;
    if (!parent) {
      shell.visible = false;
      continue;
    }
    const buckets = bucketShellTrianglesByWheel(shell, pivotCenters, JUKE_TIRE_SHELL_PROXIMITY);
    let slicedAny = false;
    for (let w = 0; w < pivots.length; w += 1) {
      const pivot = pivots[w] as Group;
      const triIndices = buckets[w] as number[];
      if (triIndices.length === 0) {
        continue;
      }
      const part = sliceMeshTriangles(shell, triIndices, 'TireShell');
      if (!part) {
        continue;
      }
      // Authored-поза куска уже согласована с диском (общий baked-toe шелла и
      // дисков) — attach без доворота; скан bearing по осколку недостоверен.
      parent.add(part);
      part.updateMatrixWorld(true);
      pivot.attach(part);
      slicedAny = true;
    }
    if (slicedAny) {
      shell.removeFromParent();
    } else {
      shell.visible = false;
    }
  }
  root.updateMatrixWorld(true);
};

/** Есть ли под пивотом прицепленная авторская покрышка (тогда тор-заглушка не нужен) */
const pivotHasAuthoredTire = (pivot: Group): boolean => {
  let found = false;
  pivot.traverse((object) => {
    if (found || !isMesh(object) || !object.visible) {
      return;
    }
    if (object.name.endsWith('_TireFill')) {
      return;
    }
    if (meshMaterialNames(object).includes(JUKE_TIRE_MATERIAL)) {
      found = true;
    }
  });
  return found;
};

/**
 * Тор-покрышка по оси диска. Диаметр — от size.y (toe не раздувает Y);
 * ширина (2·tube) — истинный осевой размах точек геометрии вдоль оси
 * (проекция AABB раздувается toe передних колёс ~20°);
 * наружный радиус тора = rimR, чтобы резина не выпирала за колесо GLB.
 * Fallback: ставится только на пивоты без авторской покрышки (attachJukeAuthoredTires).
 * Вызывать после buildWheelRig.
 */
export const attachJukeProceduralTires = (root: Object3D): void => {
  root.updateMatrixWorld(true);
  const pivots = {} as Partial<Record<TWheelPivotName, Group>>;
  for (const name of WHEEL_PIVOT_NAMES) {
    const pivot = root.getObjectByName(name);
    if (pivot && (pivot as Group).isGroup === true) {
      if (pivot.getObjectByName(`${name}_TireFill`)) {
        continue;
      }
      pivots[name] = pivot as Group;
    }
  }
  if (Object.keys(pivots).length === 0) {
    return;
  }

  const tireMat = new MeshStandardMaterial({
    name: JUKE_TIRE_MATERIAL,
    color: 0x111111,
    metalness: 0,
    roughness: 0.82,
    side: DoubleSide,
  });
  // В GLB Juke нет ротора — сквозь разрежённые спицы виден белый фендер кузова
  // (читается как «белый диск»). Компенсируем его матовым ТЁМНЫМ диском-фоновкой:
  // metalness 0 (не бликует белым под ярким светом превью), радиус доходит до
  // хромового кольца (wheel2, r≈0.202), чтобы закрыть ВСЕ щели между спицами.
  const discMat = new MeshStandardMaterial({
    name: 'jukeBrakeDisc',
    color: 0x26262a,
    metalness: 0,
    roughness: 0.9,
    side: DoubleSide,
  });

  for (const name of WHEEL_PIVOT_NAMES) {
    const pivot = pivots[name];
    if (!pivot) {
      continue;
    }

    pivot.updateMatrixWorld(true);
    tmpBox.makeEmpty();
    let hasRim = false;
    pivot.traverse((object) => {
      if (!isMesh(object) || !object.visible) {
        return;
      }
      if (object.name.endsWith('_TireFill')) {
        return;
      }
      const names = meshMaterialNames(object);
      if (!names.some((n) => JUKE_WHEEL_MATERIAL_NAMES.has(n))) {
        return;
      }
      tmpBox.expandByObject(object);
      hasRim = true;
    });
    if (!hasRim || tmpBox.isEmpty()) {
      continue;
    }

    tmpBox.getSize(tmpSize);
    const rimCenterWorld = tmpBox.getCenter(tmpCenter).clone();
    // Y ≈ диаметр; xz на передних до/без align раздут toe
    const rimR = Math.max(tmpSize.y * 0.5, 0.22);
    const axleWorld = measureWheelAxle(pivot);
    // Истинная ширина вдоль оси: проекция реальных точек геометрии на ось.
    // Мировой AABB передних колёс раздут toe (~20°): 0.534·sin20° даёт ~0.18 лишних,
    // проекция AABB выходила ~0.59 вместо фактических 0.25.
    let rawWidth = Number.NaN;
    const sampled = sampleWheelWorldPoints(pivot);
    if (sampled.length >= 8) {
      let minA = Number.POSITIVE_INFINITY;
      let maxA = Number.NEGATIVE_INFINITY;
      for (const pt of sampled) {
        const a =
          (pt.x - rimCenterWorld.x) * axleWorld.x +
          (pt.y - rimCenterWorld.y) * axleWorld.y +
          (pt.z - rimCenterWorld.z) * axleWorld.z;
        if (a < minA) {
          minA = a;
        }
        if (a > maxA) {
          maxA = a;
        }
      }
      rawWidth = maxA - minA;
    }
    if (!Number.isFinite(rawWidth) || rawWidth < 1e-3) {
      // Fallback: проекция AABB (для задних без toe она точна)
      rawWidth =
        Math.abs(tmpSize.x * axleWorld.x) +
        Math.abs(tmpSize.y * axleWorld.y) +
        Math.abs(tmpSize.z * axleWorld.z);
    }
    // Реальная толщина диска Juke ~0.25 м
    const rimWidth = Math.min(Math.max(rawWidth, 0.22), 0.28);
    // Силуэт тора = силуэт колеса GLB: наружный радиус = rimR (не выпирает),
    // ширина = 2·tube ≈ rimWidth. Раньше major = rimR·0.9 + tube давал наружный
    // радиус ~0.37 при радиусе колеса 0.268 — резина торчала на ~10 см.
    const tube = Math.min(rimWidth * 0.5, rimR * 0.48);
    const major = Math.max(rimR - tube, 0.05);

    tmpParentInv.copy(pivot.matrixWorld).invert();
    tmpA.copy(axleWorld).transformDirection(tmpParentInv).normalize();
    if (tmpA.lengthSq() < 1e-8) {
      tmpA.set(1, 0, 0);
    }
    pivot.worldToLocal(rimCenterWorld);

    // Тор — только fallback: если авторская покрышка уже на пивоте, резина не нужна
    const fill = pivotHasAuthoredTire(pivot)
      ? null
      : new Mesh(new TorusGeometry(major, tube, 16, 36), tireMat);
    if (fill) {
      fill.name = `${name}_TireFill`;
      // Torus: дыра вдоль Z → ось шины
      fill.quaternion.setFromUnitVectors(tmpB.set(0, 0, 1), tmpA);
      fill.position.copy(rimCenterWorld);
      fill.castShadow = true;
      fill.receiveShadow = true;
      fill.renderOrder = 0;
      pivot.add(fill);
    }

    // Тормозной диск-фоновка за спицами: скрывает белый фендер, крутится с колесом.
    // tmpA после fill.quaternion — локальная ось шины; tmpB переиспользуем (Y цилиндра → ось).
    // Радиус = до хромового кольца (wheel2 r≈0.202 = rimR·0.77), закрывая все щели
    // спиц; чуть залезает под кольцо → не выпирает за силуэт обода.
    const discR = Math.min(rimR * 0.77, 0.21);
    const disc = new Mesh(new CylinderGeometry(discR, discR, 0.024, 32), discMat);
    disc.name = `${name}_BrakeDisc`;
    if (tmpA.lengthSq() > 1e-8) {
      disc.quaternion.setFromUnitVectors(tmpB.set(0, 1, 0), tmpA);
    }
    disc.position.copy(rimCenterWorld);
    disc.castShadow = true;
    pivot.add(disc);

    pivot.traverse((object) => {
      if (!isMesh(object) || object === fill) {
        return;
      }
      const names = meshMaterialNames(object);
      if (names.some((n) => n === 'wheel1' || n === 'wheel2' || n === 'wheel3')) {
        object.renderOrder = 1;
      }
    });
  }
};

/**
 * Режет combined wheel2/wheel3 (хром/акценты диска) на пивоты — иначе прячем весь слой
 * и остаётся один «голый» wheel1 без обода.
 */
const attachJukeCombinedRimLayers = (
  root: Object3D,
  midX: number,
  midZ: number,
  sourceMeshes: Mesh[],
): void => {
  if (sourceMeshes.length === 0) {
    return;
  }
  root.updateMatrixWorld(true);
  const pivots = {} as Record<TWheelPivotName, Group>;
  for (const name of WHEEL_PIVOT_NAMES) {
    const pivot = root.getObjectByName(name);
    if (pivot && (pivot as Group).isGroup === true) {
      pivots[name] = pivot as Group;
    }
  }

  for (const mesh of sourceMeshes) {
    const parts = splitMeshByXzQuadrants(mesh, midX, midZ);
    const parent = mesh.parent;
    for (const name of WHEEL_PIVOT_NAMES) {
      const part = parts[name];
      const pivot = pivots[name];
      if (!part || !parent || !pivot) {
        continue;
      }
      parent.add(part);
      part.updateMatrixWorld(true);
      tmpBox.setFromObject(part);
      tmpBox.getSize(tmpSize);
      if (tmpSize.x >= 0.9 || tmpSize.z >= 1.2) {
        part.removeFromParent();
        continue;
      }
      pivot.attach(part);
    }
    mesh.removeFromParent();
  }
};

/** Juke: компактные диски wheel* + резина Matte__FF2 + ломти combined-обода на пивотах */
const normalizeJuke = (root: Object3D) => {
  // Стекло фар и задних фонарей слито в один меш glass6 — режем по Z-зазору
  splitJukeGlass6(root);
  // material_15 — красные задние стёкла (Object_54..56)
  renameMaterials(root, 'material_15', 'Brakelight');
  // orange — передняя янтарная полоса DRL (Object_52): тёплый свет фар,
  // а не красный — красный свет вперёд нереалистичен
  renameMaterials(root, 'orange', 'Headlight');
  prepareEmissiveLightMaterials(root);
  root.updateMatrixWorld(true);
  const bodyBox = tmpBox.setFromObject(root);
  // Копия: tmpCenter дальше затирается в worldCenterOf / buildWheelPivots
  const midX = bodyBox.getCenter(tmpCenter).x;
  const midZ = tmpCenter.z;

  const compact: Mesh[] = [];
  const combinedRims: Mesh[] = [];
  root.traverse((object) => {
    if (!isMesh(object)) {
      return;
    }
    const names = meshMaterialNames(object);
    if (!names.some((name) => JUKE_WHEEL_MATERIAL_NAMES.has(name))) {
      return;
    }
    tmpBox.setFromObject(object);
    tmpBox.getSize(tmpSize);
    if (tmpSize.x >= JUKE_COMBINED_WHEEL_XZ_SPAN || tmpSize.z >= JUKE_COMBINED_WHEEL_XZ_SPAN) {
      // wheel1-combined часто дублирует компактные диски — прячем;
      // wheel2/wheel3 — хром/акцент обода, режем на пивоты ниже
      if (names.includes('wheel2') || names.includes('wheel3')) {
        combinedRims.push(object);
      } else {
        object.visible = false;
      }
      return;
    }
    compact.push(object);
  });

  buildWheelPivotsFromAssemblies(root, compact, midX, midZ);
  ensureMissingWheelPivots(root);
  hideJukeTreadSlabs(root);
  attachJukeCombinedRimLayers(root, midX, midZ, combinedRims);
};

/** Scirocco: меши tire/wheel/rotor по квадрантам */
const normalizeScirocco = (root: Object3D) => {
  renameMaterials(root, 'headlight.001', 'Headlight');
  renameMaterials(root, 'headlightglass.001', 'Headlight');
  renameMaterials(root, 'brakelight.001', 'Brakelight');
  renameMaterials(root, 'brakelightglass.001', 'Brakelight');
  renameMaterials(root, 'brakelightlit.001', 'Brakelight');
  renameMaterials(root, 'brakelightglasslit', 'Brakelight');
  prepareEmissiveLightMaterials(root);
  // Сначала bake skinned → Mesh в видимой позе (ось/центр для spin), потом пивоты
  bakeSciroccoWheelSkinnedMeshes(root);
  root.updateMatrixWorld(true);
  const bodyBox = tmpBox.setFromObject(root);
  const mid = bodyBox.getCenter(tmpCenter);

  // Предпочитаем готовые группы wheel.smd*; иначе — меши по материалу
  const assemblies: Object3D[] = [];
  root.traverse((object) => {
    if (/^wheel\.smd/i.test(object.name) && object.parent) {
      assemblies.push(object);
    }
  });

  if (assemblies.length >= 4) {
    buildWheelPivotsFromAssemblies(root, assemblies, mid.x, mid.z);
  } else {
    const meshes: Mesh[] = [];
    root.traverse((object) => {
      if (!isMesh(object)) {
        return;
      }
      if (meshMaterialNames(object).some((name) => SCIROCCO_WHEEL_MATERIAL_NAMES.has(name))) {
        meshes.push(object);
      }
    });
    buildWheelPivotsFromAssemblies(root, meshes, mid.x, mid.z);
  }

  ensureMissingWheelPivots(root);
};

/**
 * Нормализует клон GLB под контракт гаража: WheelFrontL/R, WheelRearL/R,
 * фары/стопы (Headlight / Brakelight). Paint у authored-кузовов не трогаем.
 * Киберпанк (hatchback / CarConcept) уже соответствует контракту — no-op.
 */
export const normalizeVehicleGltf = (root: Object3D, vehicleId: TVehicleId): void => {
  if (vehicleId === 'sedan') {
    normalizeSedan(root);
    return;
  }
  if (vehicleId === 'pickup') {
    normalizePickup(root);
    return;
  }
  if (vehicleId === 'juke') {
    normalizeJuke(root);
    return;
  }
  if (vehicleId === 'scirocco') {
    normalizeScirocco(root);
  }
};

/**
 * Алиас для обратной совместимости.
 * @deprecated Имя сохранено для совместимости; теперь нормализует отдельный GLB.
 */
export const applyVehicleBodyVariant = normalizeVehicleGltf;

export type THeadlightLamps = {
  left: [number, number, number];
  right: [number, number, number];
};

/** Сдвиг источника чуть вперёд от стекла, чтобы луч не стартовал внутри кузова */
const HEADLIGHT_FORWARD_NUDGE = 0.05;
/** Игнор «противотуманок» ниже основных фар (модель-единицы до fit) */
const HEADLIGHT_BUMPER_Y_SLACK = 0.35;
/** Кластер носа: меши далеко сзади от maxZ не считаем фарами */
const HEADLIGHT_FRONT_Z_SLACK = 0.55;

type TLampSample = {
  x: number;
  y: number;
  z: number;
  minX: number;
  maxX: number;
  maxZ: number;
};

const toFittedLamp = (
  x: number,
  y: number,
  z: number,
  fit: TVehicleFit,
): [number, number, number] => [
  x * fit.scale + fit.offset.x,
  y * fit.scale + fit.offset.y,
  z * fit.scale + fit.offset.z + HEADLIGHT_FORWARD_NUDGE,
];

const averageAxis = (samples: TLampSample[], axis: 'x' | 'y'): number =>
  samples.reduce((sum, sample) => sum + sample[axis], 0) / samples.length;

/**
 * Позиции прожекторов по реальным мешам Headlight (пространство шасси после fit).
 * Отдельные L/R — центры; один широкий меш — точки у левого/правого края передней грани.
 */
export const measureHeadlightLampPositions = (
  root: Object3D,
  fit: TVehicleFit,
): THeadlightLamps | null => {
  root.updateMatrixWorld(true);
  const samples: TLampSample[] = [];
  root.traverse((object) => {
    if (!isMesh(object) || !object.visible) {
      return;
    }
    if (!meshMaterialNames(object).includes('Headlight')) {
      return;
    }
    tmpBox.setFromObject(object);
    tmpBox.getCenter(tmpCenter);
    samples.push({
      x: tmpCenter.x,
      y: tmpCenter.y,
      z: tmpCenter.z,
      minX: tmpBox.min.x,
      maxX: tmpBox.max.x,
      maxZ: tmpBox.max.z,
    });
  });
  if (samples.length === 0) {
    return null;
  }

  const maxY = Math.max(...samples.map((sample) => sample.y));
  const upper = samples.filter((sample) => sample.y >= maxY - HEADLIGHT_BUMPER_Y_SLACK);
  const poolY = upper.length > 0 ? upper : samples;
  const maxZ = Math.max(...poolY.map((sample) => sample.maxZ));
  const front = poolY.filter((sample) => sample.maxZ >= maxZ - HEADLIGHT_FRONT_Z_SLACK);
  const pool = front.length > 0 ? front : poolY;

  const leftMeshes = pool.filter((sample) => sample.x < -0.05);
  const rightMeshes = pool.filter((sample) => sample.x > 0.05);
  if (leftMeshes.length > 0 && rightMeshes.length > 0) {
    return {
      left: toFittedLamp(
        averageAxis(leftMeshes, 'x'),
        averageAxis(leftMeshes, 'y'),
        Math.max(...leftMeshes.map((sample) => sample.maxZ)),
        fit,
      ),
      right: toFittedLamp(
        averageAxis(rightMeshes, 'x'),
        averageAxis(rightMeshes, 'y'),
        Math.max(...rightMeshes.map((sample) => sample.maxZ)),
        fit,
      ),
    };
  }

  const minX = Math.min(...pool.map((sample) => sample.minX));
  const maxX = Math.max(...pool.map((sample) => sample.maxX));
  // Без метрного floor: cm-scale GLB (ram.glb) имеет ширину стекла ~0.025 —
  // floor 0.2 раздувал span, лампы перескакивали центр и уезжали на ±1.7 м.
  const span = Math.max(maxX - minX, 1e-4);
  const y = averageAxis(pool, 'y');
  const z = Math.max(...pool.map((sample) => sample.maxZ));
  return {
    left: toFittedLamp(minX + span * 0.22, y, z, fit),
    right: toFittedLamp(maxX - span * 0.22, y, z, fit),
  };
};

/** Fallback, если у кузова нет мешей Headlight */
export const headlightLocalPositions = (vehicleId: TVehicleId): THeadlightLamps => {
  if (vehicleId === 'sedan') {
    return {
      left: [-0.4, 0.58, 1.46],
      right: [0.4, 0.58, 1.46],
    };
  }
  if (vehicleId === 'pickup') {
    return {
      left: [-0.4, 0.95, 2.35],
      right: [0.4, 0.95, 2.35],
    };
  }
  if (vehicleId === 'juke') {
    return {
      left: [-0.55, 0.55, 1.85],
      right: [0.55, 0.55, 1.85],
    };
  }
  if (vehicleId === 'scirocco') {
    return {
      left: [-0.55, 0.42, 1.65],
      right: [0.55, 0.42, 1.65],
    };
  }
  return {
    left: [-0.58, 0.48, 1.55],
    right: [0.58, 0.48, 1.55],
  };
};

/** Измеряет фары или возвращает fallback по vehicleId */
export const resolveHeadlightLampPositions = (
  root: Object3D,
  fit: TVehicleFit,
  vehicleId: TVehicleId,
): THeadlightLamps =>
  measureHeadlightLampPositions(root, fit) ?? headlightLocalPositions(vehicleId);

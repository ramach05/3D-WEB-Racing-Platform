import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  Vector3,
  type Material,
  type Object3D,
  type MeshStandardMaterial,
} from 'three';
import type { TVehicleId } from '@/entities/vehicle';
import type { TVehicleFit } from '@/widgets/race-canvas/vehicle/vehicle-fit';

/**
 * Bust useMemo clone cache when normalize logic changes (HMR).
 * Bump when shipping visual fixes for garage bodies.
 */
export const VEHICLE_VARIANT_REV = 30;

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

const SCIROCCO_WHEEL_MATERIAL_NAMES = new Set(['wheel.001', 'tire', 'rotor1', 'rotor0']);

const tmpBox = new Box3();
const tmpCenter = new Vector3();
const tmpSize = new Vector3();
const tmpA = new Vector3();
const tmpB = new Vector3();
const tmpC = new Vector3();

const isMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true;

const isStandardMaterial = (material: Material): material is MeshStandardMaterial =>
  (material as MeshStandardMaterial).isMeshStandardMaterial === true;

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
      material.metalness = Math.min(material.metalness, 0.2);
      material.roughness = Math.max(material.roughness, 0.35);
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

const normalizePickup = (root: Object3D) => {
  renameMaterials(root, 'RAM_1500TRX_2021LightA_Material', 'Headlight');
  renameMaterials(root, 'RED_GLASS', 'Brakelight');
  renameMaterials(root, 'ORANGE_GLASS', 'Signallight');
  prepareEmissiveLightMaterials(root);
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
const splitMeshByWorldZ = (
  mesh: Mesh,
  splitZ: number,
): { low: Mesh | null; high: Mesh | null } => {
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

/** Juke: компактные Object_* с материалом wheel*; combined-слои прячем */
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
  const mid = bodyBox.getCenter(tmpCenter);

  const compact: Mesh[] = [];
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
      object.visible = false;
      return;
    }
    compact.push(object);
  });

  buildWheelPivotsFromAssemblies(root, compact, mid.x, mid.z);
  ensureMissingWheelPivots(root);
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
  const span = Math.max(maxX - minX, 0.2);
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
      left: [-0.85, 0.95, 2.35],
      right: [0.85, 0.95, 2.35],
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

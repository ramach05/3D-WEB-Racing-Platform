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

/** Bust useMemo clone cache when normalize logic changes (HMR). Bump when shipping visual fixes for garage bodies. */
export const VEHICLE_VARIANT_REV = 76;

const WHEEL_PIVOT_NAMES = ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR'] as const;
type TWheelPivotName = (typeof WHEEL_PIVOT_NAMES)[number];

const PICKUP_WHEEL_NODE_NAMES = ['polySurface1', 'polySurface8441'] as const;
const PICKUP_CALIPER_NODE_NAMES = ['polySurface9497', 'polySurface9559'] as const;

/** Logan (Sketchfab "Renault Logan 2004"): base blue body color */
export const SEDAN_BODY_COLOR = 0x1660c8;

/** Logan body panels painted blue (not plastic/tires/lights; bumpers in the atlas gave a red bottom) */
const SEDAN_BODY_PANEL_PATTERN =
  /^(Kuzov_low|Kuzov_Bak_low|Kapot_low|Dver_1_low|Dver_2_low|Bagajnik_low|Bamper_(?:pered|zad)_[0-9]_low)_/i;

/** Logan: light fixtures share the atlas material Kuzov1 with the body, so split-clone them by mesh name onto contract names. */
const SEDAN_LIGHT_RULES = [
  { pattern: /^Fara_1_low_/i, materialName: 'Headlight' },
  { pattern: /^Fara_2_low_/i, materialName: 'Headlight' },
  { pattern: /^Fara_lamp_low_/i, materialName: 'Headlight' },
  { pattern: /^Protivotumanki_low_/i, materialName: 'Headlight' },
  { pattern: /^Fonar_low_/i, materialName: 'Brakelight' },
  { pattern: /^Povorotnik_low_/i, materialName: 'Signallight' },
] as const;

/** Logan: combined wheel meshes (all 4 wheels in one mesh) */
const SEDAN_WHEEL_MESH_NAMES = ['Rezina_low_Kuzov1_0', 'Disk_low_Kuzov1_0'] as const;

const JUKE_WHEEL_MATERIAL_NAMES = new Set(['wheel1', 'wheel2', 'wheel3']);
/** Combined juke wheel layers span ~full track width — hide them when using compact wheels */
const JUKE_COMBINED_WHEEL_XZ_SPAN = 1.2;
/**
 * Sketchfab: black rubber Matte__FF2 lies separately from metallic wheel1 rims.
 * Without attaching to the pivot the rubber doesn't spin → "two wheels"; without it — bare rims.
 */
const JUKE_TIRE_MATERIAL = 'Matte__FF2';
/** Tire/brake-disc height (m) */
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
 * World position of a SkinnedMesh vertex as in AttachedBindMode:
 * Σ (bone.matrixWorld · boneInverse · bindMatrix · v) · weight.
 * Independent of the mesh's bindMode/matrixWorld — bones + bindMatrix only.
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

/** Bakes a wheel SkinnedMesh into a plain Mesh in the visible (bone-skinned) pose. Otherwise measureWheelAxle/spin rotate raw bind geometry past the real tire axis. */
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
  // clone() copies the stale boundingBox from the bind pose — otherwise pivots/spin shift away
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

/** Scirocco: bakes tire/rim/rotor SkinnedMeshes before pivot assembly. */
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

/** Renames materials by exact name (all occurrences in the tree) */
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
 * Authored light materials often have metalness≈1 — at night they mirror the darkness.
 * Lower metalness on Headlight / Brakelight / Signallight so emissive reads.
 * Brakelight/Signallight — glossy lens polycarbonate; Headlight — off by default.
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
        // Glossy lens: low roughness gives highlights instead of flat "paint"
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
 * Builds a new Mesh from selected triangles of the source mesh (attribute reindexing).
 * Geometry stays in the source mesh's local space, transform is copied 1:1.
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

/** Cuts one "all 4 wheels" mesh into up to 4 meshes by XZ quadrants (by triangle centroid). Geometry stays in the source mesh's local space. */
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

/** Collects meshes under a node (the node itself if it's a Mesh) */
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

/** Centers pivots by children bbox (local parent = root) */
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

/** Splits combined wheel meshes onto 4 pivots; removes the source meshes. midX/midZ — body center in world (usually ~0). */
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

/** Attaches already separate wheel assemblies (groups/meshes) to 4 pivots by world quadrant. */
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

/** Empty mirror pivots for missing rear wheels (rig symmetry) */
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

/** Physics drives along +Z. If headlights sit behind the brakes — rotate the body 180° so the nose faces forward (wheels are attached after this). */
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

/** Logan: clones light-mesh materials onto contract names Headlight/... */
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
      // The Kuzov1 atlas darkens the lenses — color is set by prepareEmissiveLightMaterials
      clone.map = null;
      return clone;
    });
    const next = Array.isArray(object.material) ? renamed : renamed[0];
    if (next) {
      object.material = next;
    }
  });
};

/** Logan: paints body panels and bumpers blue, detaching them from the atlas texture */
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
 * Logan (Sketchfab "Renault Logan 2004"): one atlas material Kuzov1 across the body,
 * light fixtures are separate meshes by name. Maps them onto the contract, paints
 * panels and bumpers blue, cuts combined wheels (Rezina/Disk) onto 4 pivots like the pickup's.
 */
const normalizeSedan = (root: Object3D) => {
  splitSedanMeshesByLightRule(root);
  prepareEmissiveLightMaterials(root);
  paintSedanBodyBlue(root);
  // Logan authored nose in −Z? Align to the race contract (+Z) if needed
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

/** Pickup: burgundy body instead of the GLB's authored blue, doesn't blend with Logan */
export const PICKUP_BODY_COLOR = 0x71121f;

/**
 * Clone the paint material (like the sedan's) so we don't repaint the original
 * GLB scene; roughness — auto-gloss lacquer instead of authored matte 0.96;
 * metalness untouched: without envMap metal goes black in the scene.
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

/** Juke (Sketchfab "material-merged"): headlight and tail light glass is one glass6 mesh */
const JUKE_GLASS6_MATERIAL = 'glass6';
/** If light clusters are less than this distance apart in world Z — don't cut */
const JUKE_GLASS_SPLIT_MIN_GAP = 0.4;

/** World Z of the mesh's triangle centroids (for nose/tail clustering) */
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

/** Middle of the largest gap between sorted world Zs (cluster boundary) */
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

/** Returns two mesh parts: low (world z < splitZ) and high (world z >= splitZ) */
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

/** Clones the mesh material(s) into the Headlight/Brakelight role */
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
 * Juke: material glass6 is one merged mesh holding both headlight glass (nose, +Z)
 * and tail light glass (tail, −Z). Cut at the largest world Z gap:
 * front → Headlight, rear → Brakelight, so tail lights don't glow yellow
 * (like headlights) but burn red together with material_15.
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
      return; // single cluster — keep as is (fallback to the previous behavior)
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
 * Authored Matte__FF2 — meshmerger's tread "slabs" merged across the axis: shaggy
 * 0.44–0.58 m slabs (3x wider than a wheel), their loomths stick out past the tire
 * footprint as blades when steering — hide them. Shells long along the wheelbase (z ≥ 1.2 m) are
 * not undertrays: in juke.glb that's all 4 wheels' tires in one mesh — attachJukeTiresToRimPose
 * cuts them into pieces and hangs them on pivots.
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

/** Rotate an object in world around a world point (axis through it). */
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

/** Radius of the shell's wheel-side piece: vertices farther from the wheel center belong to the "bridge". */
const JUKE_TIRE_SHELL_PROXIMITY = 0.55;

/**
 * Distributes merged tire-shell triangles across wheels: a triangle lands in bucket w
 * only if all 3 of its world vertices are near wheel center w.
 * Meshmerger "bridges" between wheels are dropped — on a pivot they
 * would make blades sticking past the tire footprint. Bucket format —
 * flat vertex-index triples, as sliceMeshTriangles expects.
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
 * Matte__FF2 tires onto pivots — BEFORE buildWheelRig (see prepareVehicleRoot):
 * the authored tire pose matches the rims' baked toe (~20°) at the factory, so
 * attach without extra rotation is enough — align/steer/spin rotate rim and tire as one
 * assembly. For compact sidewalls we keep a defensive delta: rotate to the rim's bearing
 * measured in the SAME frame (0 before align; a call after the rig doesn't break).
 * Merged meshmerger shells are cut into wheel-side pieces: bearing scans on fragments
 * are unreliable, so they keep the authored pose 1:1 relative to the rim.
 */
export const attachJukeTiresToRimPose = (root: Object3D): void => {
  root.updateMatrixWorld(true);
  const pivotGroups = {} as Partial<Record<TWheelPivotName, Group>>;
  for (const name of WHEEL_PIVOT_NAMES) {
    const pivot = root.getObjectByName(name);
    if (pivot && (pivot as Group).isGroup === true && !pivotHasAuthoredTire(pivot as Group)) {
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
    // Rotation around Y by θ changes bearing b to b−θ ⇒ θ = bT − bR.
    const tireAxle = measureWheelAxle(tire);
    const delta = Math.atan2(tireAxle.z, tireAxle.x) - (rimBearing.get(bestPivot) ?? 0);
    if (Math.abs(delta) > 1e-4) {
      rotateAroundWorldPoint(tire, JUKE_WORLD_UP, delta, center);
      tire.updateWorldMatrix(true, false);
    }
    bestPivot.attach(tire);
  }

  // Meshmerger-merged tire shells: one mesh across several wheels (bbox ≥ 1.2 m)
  // fails the compact filter above, and hideJukeTreadSlabs doesn't hide it (z ≥ 1.2
  // counted as "undertray"). Result — a static "tire" with the front wheels' baked toe
  // in front of a steering rim. Cut such a shell into wheel-side pieces and hang each
  // on its pivot at the rim's bearing; delete the original (bridges between wheels dropped).
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
      // The piece's authored pose is already aligned with the rim (shared baked toe of the
      // shell and rims) — attach without extra rotation; a bearing scan on a fragment is unreliable.
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

/** Whether an authored tire is attached under the pivot (then no tor placeholder is needed) */
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
 * Torus tire along the rim axis. Diameter — from size.y (toe doesn't inflate Y);
 * width (2·tube) — the true axial spread of geometry points along the axis
 * (the AABB projection is inflated by the front wheels' toe ~20°);
 * torus outer radius = rimR so the rubber doesn't bulge past the GLB wheel.
 * Fallback: placed only on pivots without an authored tire (attachJukeAuthoredTires).
 * Call after buildWheelRig.
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
  // The Juke GLB has no rotor — the white body fender shows through sparse spokes
  // (reads as a "white rim"). Compensate with a matte DARK backdrop disc:
  // metalness 0 (no white glare under bright preview light), radius reaches the
  // chrome ring (wheel2, r≈0.202) to cover ALL gaps between the spokes.
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
    // Y ≈ diameter; xz on the front before/without align is inflated by toe
    const rimR = Math.max(tmpSize.y * 0.5, 0.22);
    const axleWorld = measureWheelAxle(pivot);
    // True width along the axis: projection of real geometry points onto the axis.
    // The front wheels' world AABB is inflated by toe (~20°): 0.534·sin20° adds ~0.18,
    // the AABB projection came out ~0.59 instead of the actual 0.25.
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
      // Fallback: AABB projection (exact for rear wheels without toe)
      rawWidth =
        Math.abs(tmpSize.x * axleWorld.x) +
        Math.abs(tmpSize.y * axleWorld.y) +
        Math.abs(tmpSize.z * axleWorld.z);
    }
    // Real Juke rim thickness ~0.25 m
    const rimWidth = Math.min(Math.max(rawWidth, 0.22), 0.28);
    // Torus silhouette = GLB wheel silhouette: outer radius = rimR (no bulge),
    // width = 2·tube ≈ rimWidth. Previously major = rimR·0.9 + tube gave an outer
    // radius of ~0.37 at wheel radius 0.268 — the rubber stuck out ~10 cm.
    const tube = Math.min(rimWidth * 0.5, rimR * 0.48);
    const major = Math.max(rimR - tube, 0.05);

    tmpParentInv.copy(pivot.matrixWorld).invert();
    tmpA.copy(axleWorld).transformDirection(tmpParentInv).normalize();
    if (tmpA.lengthSq() < 1e-8) {
      tmpA.set(1, 0, 0);
    }
    pivot.worldToLocal(rimCenterWorld);

    // Torus is fallback-only: if an authored tire is already on the pivot, no rubber needed
    const fill = pivotHasAuthoredTire(pivot)
      ? null
      : new Mesh(new TorusGeometry(major, tube, 16, 36), tireMat);
    if (fill) {
      fill.name = `${name}_TireFill`;
      // Torus: hole along Z → tire axis
      fill.quaternion.setFromUnitVectors(tmpB.set(0, 0, 1), tmpA);
      fill.position.copy(rimCenterWorld);
      fill.castShadow = true;
      fill.receiveShadow = true;
      fill.renderOrder = 0;
      pivot.add(fill);
    }

    // Backdrop brake disc behind the spokes: hides the white fender, spins with the wheel. tmpA after fill.quaternion — the local tire axis; reuse tmpB (cylinder Y → axis).
    // Radius = up to the chrome ring (wheel2 r≈0.202 = rimR·0.77), covering all spoke gaps; slips slightly under the ring → doesn't bulge past the rim silhouette.
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

/** Cuts combined wheel2/wheel3 (rim chrome/accents) onto pivots — otherwise the whole layer is hidden and only a bare wheel1 without a rim remains. */
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

/** Juke: compact wheel* rims + Matte__FF2 rubber + combined-rim slices on pivots */
const normalizeJuke = (root: Object3D) => {
  // Headlight and tail light glass is merged into one glass6 mesh — cut by the Z gap
  splitJukeGlass6(root);
  // material_15 — red rear glass (Object_54..56)
  renameMaterials(root, 'material_15', 'Brakelight');
  // orange — front amber DRL strip (Object_52): warm headlight glow,
  // not red — red light forward is unrealistic
  renameMaterials(root, 'orange', 'Headlight');
  prepareEmissiveLightMaterials(root);
  root.updateMatrixWorld(true);
  const bodyBox = tmpBox.setFromObject(root);
  // Copy: tmpCenter gets overwritten later in worldCenterOf / buildWheelPivots
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
      // wheel1-combined often duplicates the compact rims — hide it;
      // wheel2/wheel3 — rim chrome/accents, cut onto pivots below
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

/** Scirocco: tire/wheel/rotor meshes by quadrant */
const normalizeScirocco = (root: Object3D) => {
  renameMaterials(root, 'headlight.001', 'Headlight');
  renameMaterials(root, 'headlightglass.001', 'Headlight');
  renameMaterials(root, 'brakelight.001', 'Brakelight');
  renameMaterials(root, 'brakelightglass.001', 'Brakelight');
  renameMaterials(root, 'brakelightlit.001', 'Brakelight');
  renameMaterials(root, 'brakelightglasslit', 'Brakelight');
  prepareEmissiveLightMaterials(root);
  // First bake skinned → Mesh in the visible pose (axis/center for spin), then pivots
  bakeSciroccoWheelSkinnedMeshes(root);
  root.updateMatrixWorld(true);
  const bodyBox = tmpBox.setFromObject(root);
  const mid = bodyBox.getCenter(tmpCenter);

  // Prefer ready-made wheel.smd* groups; otherwise — meshes by material
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
 * Normalizes a GLB clone to the garage contract: WheelFrontL/R, WheelRearL/R,
 * headlights/brakes (Headlight / Brakelight). Doesn't touch Paint on authored bodies.
 * Cyberpunk (hatchback / CarConcept) already matches the contract — no-op.
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
 * Alias for backward compatibility.
 * @deprecated Name kept for compatibility; now normalizes a separate GLB.
 */
export const applyVehicleBodyVariant = normalizeVehicleGltf;

export type THeadlightLamps = {
  left: [number, number, number];
  right: [number, number, number];
};

/** Shift the source slightly forward of the glass so the beam doesn't start inside the body */
const HEADLIGHT_FORWARD_NUDGE = 0.05;
/** Ignore "fog lights" below the main headlights (model units before fit) */
const HEADLIGHT_BUMPER_Y_SLACK = 0.35;
/** Nose cluster: meshes far behind maxZ are not counted as headlights */
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
 * Spotlight positions from real Headlight meshes (chassis space after fit).
 * Separate L/R — centers; one wide mesh — points near the left/right edge of the front face.
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
  // No metric floor: cm-scale GLB (ram.glb) has a glass width of ~0.025 —
  // a 0.2 floor inflated the span, lamps jumped past the center to ±1.7 m.
  const span = Math.max(maxX - minX, 1e-4);
  const y = averageAxis(pool, 'y');
  const z = Math.max(...pool.map((sample) => sample.maxZ));
  return {
    left: toFittedLamp(minX + span * 0.22, y, z, fit),
    right: toFittedLamp(maxX - span * 0.22, y, z, fit),
  };
};

/** Fallback if the body has no Headlight meshes */
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

/** Measures headlights or returns a per-vehicleId fallback */
export const resolveHeadlightLampPositions = (
  root: Object3D,
  fit: TVehicleFit,
  vehicleId: TVehicleId,
): THeadlightLamps =>
  measureHeadlightLampPositions(root, fit) ?? headlightLocalPositions(vehicleId);

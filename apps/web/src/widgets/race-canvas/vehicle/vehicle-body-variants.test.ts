import {
  Bone,
  Box3,
  BoxGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Texture,
  Uint16BufferAttribute,
  Vector3,
  type Object3D,
} from 'three';
import {
  PICKUP_BODY_COLOR,
  SEDAN_BODY_COLOR,
  attachJukeProceduralTires,
  measureHeadlightLampPositions,
  normalizeVehicleGltf,
} from './vehicle-body-variants';
import { computeVehicleFit } from './vehicle-fit';
import { describe, expect, it } from 'vitest';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Стенд CarConcept-подобных имён для хэтчбека / Киберпанка */
const buildHatchStub = (): Group => {
  const root = new Group();
  const paint = new MeshStandardMaterial({ name: 'Paint 1 Carmine', color: '#cc0000' });
  const underside = new Group();
  underside.name = 'BodyUnderside';
  root.add(underside);

  const hood = new Mesh(new BoxGeometry(1.5, 0.4, 1.2), paint);
  hood.name = 'BodyHood';
  hood.position.set(0, 0.7, 1.5);
  underside.add(hood);

  for (const [name, x, z] of [
    ['WheelFrontL', 0.8, 1.2],
    ['WheelFrontR', -0.8, 1.2],
    ['WheelRearL', 0.8, -1.2],
    ['WheelRearR', -0.8, -1.2],
  ] as const) {
    const wheel = new Group();
    wheel.name = name;
    wheel.position.set(x, 0.3, z);
    underside.add(wheel);
  }

  return root;
};

/** Logan (Sketchfab «Renault Logan 2004»): атласный Kuzov1 на весь кузов + отдельные меши света */
const buildSedanStub = (): Group => {
  const root = new Group();
  const kuzov1 = new MeshStandardMaterial({
    name: 'Kuzov1',
    color: '#cc3333',
    map: new Texture(),
    metalness: 0.7,
    roughness: 0.4,
  });
  const glass = new MeshStandardMaterial({
    name: 'glass',
    color: '#88ccff',
    map: new Texture(),
    metalness: 1,
    roughness: 0.1,
  });
  root.add(
    new Mesh(new BoxGeometry(3.2, 0.4, 4.6), new MeshStandardMaterial({ name: 'Podveska_Salon' })),
  );

  const panel = (
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) => {
    const mesh = new Mesh(new BoxGeometry(w, h, d), kuzov1);
    mesh.name = name;
    mesh.position.set(x, y, z);
    root.add(mesh);
  };

  // Панели кузова — красим в синий
  panel('Kuzov_low_Kuzov1_0', 0, 1.05, 0, 3.2, 0.9, 4.6);
  panel('Kapot_low_Kuzov1_0', 0, 1.5, 2.2, 2.8, 0.18, 0.7);
  panel('Dver_1_low_Kuzov1_0', 0, 1.05, 0.8, 3.2, 0.9, 0.4);
  panel('Dver_2_low_Kuzov1_0', 0, 1.05, -0.8, 3.2, 0.9, 0.4);
  panel('Bagajnik_low_Kuzov1_0', 0, 1.15, -1.95, 2.4, 0.2, 0.6);
  panel('Kuzov_Bak_low_Kuzov1_0', 0, 1.1, -1.85, 0.3, 0.1, 0.1);

  // Бамперы — тоже красим в синий (в атласе у них красный низ)
  panel('Bamper_pered_1_low_Kuzov1_0', 0, 0.75, 2.5, 3.0, 0.35, 0.25);
  panel('Bamper_pered_3_low_Kuzov1_0', 0, 0.5, 2.5, 3.0, 0.2, 0.2);
  panel('Bamper_zad_1_low_Kuzov1_0', 0, 0.8, -2.5, 3.0, 0.35, 0.25);
  panel('Bamper_zad_2_low_Kuzov1_0', 0, 0.55, -2.5, 3.0, 0.2, 0.2);

  // Светильники: стёкла фар отдельными мешами, фонарь — единая полноширинная плашка
  const hl = new Mesh(new BoxGeometry(0.15, 0.1, 0.1), glass);
  hl.name = 'Fara_1_low_glass_0';
  hl.position.set(-0.2, 1.3, 2.55);
  root.add(hl);
  const hl2 = new Mesh(new BoxGeometry(0.15, 0.1, 0.1), kuzov1);
  hl2.name = 'Fara_2_low_Kuzov1_0';
  hl2.position.set(0.2, 1.3, 2.5);
  root.add(hl2);
  const lamp = new Mesh(new BoxGeometry(2.6, 0.12, 0.3), kuzov1);
  lamp.name = 'Fara_lamp_low_Kuzov1_0';
  lamp.position.set(0, 1.3, 2.55);
  root.add(lamp);
  const fog = new Mesh(new BoxGeometry(2.0, 0.25, 0.25), kuzov1);
  fog.name = 'Protivotumanki_low_Kuzov1_0';
  fog.position.set(0, 0.35, 2.6);
  root.add(fog);
  const tail = new Mesh(new BoxGeometry(2.4, 0.18, 0.1), kuzov1);
  tail.name = 'Fonar_low_Kuzov1_0';
  tail.position.set(0, 1.3, -2.45);
  root.add(tail);
  const signal = new Mesh(new BoxGeometry(2.6, 0.1, 0.06), kuzov1);
  signal.name = 'Povorotnik_low_Kuzov1_0';
  signal.position.set(0, 1.3, 1.9);
  root.add(signal);

  // Лобовое стекло (материал glass — НЕ светильник)
  const windshield = new Mesh(new BoxGeometry(1.6, 0.3, 1.6), glass);
  windshield.name = 'Glass_low_glass_0';
  windshield.position.set(0, 1.7, 0.9);
  root.add(windshield);

  // Колёса — combined-меши шин и дисков на все 4 колеса (как в реальном GLB)
  const wheelSpots: Array<[number, number, number]> = [
    [0.9, 0.43, 1.7],
    [-0.9, 0.43, 1.7],
    [0.9, 0.43, -1.5],
    [-0.9, 0.43, -1.5],
  ];
  const tireGeo = wheelSpots.map(([x, y, z]) => new BoxGeometry(0.4, 0.9, 0.9).translate(x, y, z));
  const rimGeo = wheelSpots.map(([x, y, z]) => new BoxGeometry(0.22, 0.6, 0.6).translate(x, y, z));
  const tireMesh = new Mesh(mergeGeometries(tireGeo)!, kuzov1);
  tireMesh.name = 'Rezina_low_Kuzov1_0';
  root.add(tireMesh);
  const rimMesh = new Mesh(mergeGeometries(rimGeo)!, kuzov1);
  rimMesh.name = 'Disk_low_Kuzov1_0';
  root.add(rimMesh);

  return root;
};

/** RAM: combined wheel surfaces spanning both sides */
const buildPickupStub = (): Group => {
  const root = new Group();
  const paint = new MeshStandardMaterial({
    name: 'RAM_1500TRX_2021Paint_Material',
    color: '#886644',
  });
  const headlight = new MeshStandardMaterial({
    name: 'RAM_1500TRX_2021LightA_Material',
    color: '#fff8e0',
  });
  const brakelight = new MeshStandardMaterial({ name: 'RED_GLASS', color: '#ff0000' });
  const signal = new MeshStandardMaterial({ name: 'ORANGE_GLASS', color: '#ff8800' });
  const wheelMat = new MeshStandardMaterial({
    name: 'RAM_1500TRX_2021_Wheel1A_3D_3DWheel2A_Material',
    color: '#222222',
  });

  const body = new Mesh(new BoxGeometry(2.3, 1.3, 5.2), paint);
  body.name = 'PaintBody';
  root.add(body);
  const hl = new Mesh(new BoxGeometry(2.0, 0.26, 0.1), headlight);
  hl.name = 'LightGeo';
  root.add(hl);
  const bl = new Mesh(new BoxGeometry(2.0, 0.14, 0.04), brakelight);
  bl.name = 'RedGlass';
  root.add(bl);
  const sig = new Mesh(new BoxGeometry(0.4, 0.12, 0.04), signal);
  sig.name = 'OrangeGlass';
  root.add(sig);

  const wheelGeos = (
    [
      [0.94, 0.43, 1.89],
      [-0.94, 0.43, 1.89],
      [0.94, 0.43, -1.23],
      [-0.94, 0.43, -1.23],
    ] as const
  ).map(([x, y, z]) => {
    const geo = new BoxGeometry(0.4, 0.88, 0.88);
    geo.translate(x, y, z);
    return geo;
  });

  const fl = new Group();
  fl.name = 'polySurface1';
  root.add(fl);
  fl.add(new Mesh(mergeGeometries(wheelGeos)!, wheelMat));

  const fr = new Group();
  fr.name = 'polySurface8441';
  root.add(fr);
  const discGeos = wheelGeos.map((g) => g.clone());
  fr.add(new Mesh(mergeGeometries(discGeos)!, wheelMat.clone()));

  const caliperL = new Group();
  caliperL.name = 'polySurface9497';
  root.add(caliperL);
  const caliperGeos = (
    [
      [0.94, 0.43, 1.89],
      [-0.94, 0.43, 1.89],
    ] as const
  ).map(([x, y, z]) => {
    const geo = new BoxGeometry(0.15, 0.2, 0.2);
    geo.translate(x, y, z);
    return geo;
  });
  caliperL.add(new Mesh(mergeGeometries(caliperGeos)!, wheelMat.clone()));

  const caliperR = new Group();
  caliperR.name = 'polySurface9559';
  root.add(caliperR);
  const caliperRearGeos = (
    [
      [0.94, 0.43, -1.23],
      [-0.94, 0.43, -1.23],
    ] as const
  ).map(([x, y, z]) => {
    const geo = new BoxGeometry(0.15, 0.2, 0.2);
    geo.translate(x, y, z);
    return geo;
  });
  caliperR.add(new Mesh(mergeGeometries(caliperRearGeos)!, wheelMat.clone()));

  return root;
};

/** Juke: как в реальном GLB — стекло фар (+Z) и задних фонарей (−Z) слито в один меш glass6 */
const buildJukeStub = (): Group => {
  const root = new Group();
  const bodyMat = new MeshStandardMaterial({ name: 'body1', color: '#cc2200' });
  const wheelMat = new MeshStandardMaterial({ name: 'wheel1', color: '#111111' });
  const ghostMat = new MeshStandardMaterial({ name: 'Matte__FF2', color: '#111111' });
  const signal = new MeshStandardMaterial({ name: 'orange', color: '#ff8800' });
  const brakelight = new MeshStandardMaterial({ name: 'material_15', color: '#cc0000' });
  const headlight = new MeshStandardMaterial({ name: 'glass6', color: '#aa9900' });

  root.add(new Mesh(new BoxGeometry(1.6, 1.0, 3.8), bodyMat));

  // Sketchfab materialmerger: передний кластер (фары) и задний (стекло фонарей) —
  // одни меш glass6, посередине зазор (у реального GLB кластеры аналогичны)
  const frontLens = new BoxGeometry(1.4, 0.12, 0.14);
  frontLens.translate(0, 0.45, 1.85);
  const rearLens = new BoxGeometry(1.4, 0.12, 0.14);
  rearLens.translate(0, 0.45, -1.8);
  const glassGeo = mergeGeometries([frontLens, rearLens]);
  const glass = new Mesh(glassGeo ?? new BoxGeometry(0.1, 0.1, 0.1), headlight);
  glass.name = 'MergedLightGlass';
  root.add(glass);

  // Красная плашка задних фонарей — отдельным мешем material_15
  const bl = new Mesh(new BoxGeometry(1.0, 0.08, 0.1), brakelight);
  bl.name = 'TaillightGlass';
  bl.position.set(0, 0.4, -1.8);
  root.add(bl);

  // Янтарная полоса DRL/поворотника в переднем бампере (как на реальном Juke)
  const drl = new Mesh(new BoxGeometry(1.4, 0.05, 0.05), signal);
  drl.name = 'SignalStrip';
  drl.position.set(0, 0.35, 1.5);
  root.add(drl);

  for (const [x, z] of [
    [0.7, 1.1],
    [-0.7, 1.1],
    [0.7, -1.1],
    [-0.7, -1.1],
  ] as const) {
    const wheel = new Mesh(new BoxGeometry(0.25, 0.5, 0.5), wheelMat);
    wheel.position.set(x, 0.25, z);
    root.add(wheel);
    // Призрак Matte__FF2 в той же арке (как Object_8/16/19/27 в juke.glb)
    const ghost = new Mesh(new BoxGeometry(0.26, 0.64, 0.62), ghostMat);
    ghost.name = `GhostWheel_${x}_${z}`;
    ghost.position.set(x, 0.25, z);
    root.add(ghost);
  }

  const combined = new Mesh(new BoxGeometry(1.8, 0.3, 2.8), wheelMat.clone());
  combined.name = 'CombinedWheelLayer';
  combined.position.set(0, 0.25, 0);
  root.add(combined);

  return root;
};

/** Scirocco: wheel.smd groups + light materials */
const buildSciroccoStub = (): Group => {
  const root = new Group();
  const paint = new MeshStandardMaterial({ name: 'skin_0.001', color: '#334455' });
  const headlight = new MeshStandardMaterial({ name: 'headlight.001', color: '#fff8e0' });
  const brakelight = new MeshStandardMaterial({ name: 'brakelight.001', color: '#ff0000' });
  const tire = new MeshStandardMaterial({ name: 'tire', color: '#111111' });
  const rim = new MeshStandardMaterial({ name: 'wheel.001', color: '#888888' });

  const body = new Mesh(new BoxGeometry(1.7, 1.0, 3.6), paint);
  body.name = 'BodyPaint';
  root.add(body);
  const hl = new Mesh(new BoxGeometry(1.2, 0.1, 0.12), headlight);
  hl.name = 'HeadlightGlass';
  root.add(hl);
  const bl = new Mesh(new BoxGeometry(1.0, 0.1, 0.12), brakelight);
  bl.name = 'TaillightGlass';
  root.add(bl);

  for (const [name, x, z] of [
    ['wheel.smd_26', 0.65, 1.0],
    ['wheel.smd.001_27', -0.65, 1.0],
    ['wheel.smd.002_28', 0.65, -1.15],
    ['wheel.smd.003_29', -0.65, -1.15],
  ] as const) {
    const group = new Group();
    group.name = name;
    group.position.set(x, 0.2, z);
    root.add(group);
    group.add(new Mesh(new BoxGeometry(0.2, 0.45, 0.45), tire));
    group.add(new Mesh(new BoxGeometry(0.12, 0.35, 0.35), rim));
  }

  return root;
};

/** Минимальный SkinnedMesh-шина (как в реальном scirocco.glb — без wheel.smd*). */
const makeSkinnedTire = (material: MeshStandardMaterial, x: number, z: number): SkinnedMesh => {
  const geometry = new BoxGeometry(0.2, 0.45, 0.45);
  const count = geometry.getAttribute('position').count;
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  for (let i = 0; i < count; i += 1) {
    skinIndices.push(0, 0, 0, 0);
    skinWeights.push(1, 0, 0, 0);
  }
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(skinWeights, 4));

  const bone = new Bone();
  const skeleton = new Skeleton([bone]);
  const mesh = new SkinnedMesh(geometry, material);
  mesh.position.set(x, 0.2, z);
  mesh.add(bone);
  mesh.bind(skeleton);
  return mesh;
};

/**
 * Scirocco как в прод-GLB: колёса — SkinnedMesh по материалам tire/wheel,
 * без групп wheel.smd* (fallback-ветка normalizeScirocco).
 */
const buildSciroccoSkinnedStub = (): Group => {
  const root = new Group();
  const paint = new MeshStandardMaterial({ name: 'skin_0.001', color: '#334455' });
  const headlight = new MeshStandardMaterial({ name: 'headlight.001', color: '#fff8e0' });
  const brakelight = new MeshStandardMaterial({ name: 'brakelight.001', color: '#ff0000' });
  const tire = new MeshStandardMaterial({ name: 'tire', color: '#111111' });
  const rim = new MeshStandardMaterial({ name: 'wheel.001', color: '#888888' });

  root.add(new Mesh(new BoxGeometry(1.7, 1.0, 3.6), paint));
  root.add(new Mesh(new BoxGeometry(1.2, 0.1, 0.12), headlight));
  root.add(new Mesh(new BoxGeometry(1.0, 0.1, 0.12), brakelight));

  for (const [x, z] of [
    [0.65, 1.0],
    [-0.65, 1.0],
    [0.65, -1.15],
    [-0.65, -1.15],
  ] as const) {
    root.add(makeSkinnedTire(tire, x, z));
    root.add(makeSkinnedTire(rim, x, z));
  }

  return root;
};

const materialNamesOn = (root: Object3D, meshName: string): string[] => {
  const mesh = root.getObjectByName(meshName) as Mesh | undefined;
  if (!mesh || !mesh.isMesh) {
    return [];
  }
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.map((material) => material.name);
};

const materialNamesUnder = (root: Object3D, pivotName: string): string[] => {
  const pivot = root.getObjectByName(pivotName);
  if (!pivot) {
    return [];
  }
  const names: string[] = [];
  pivot.traverse((object) => {
    if (!(object as Mesh).isMesh) {
      return;
    }
    const materials = Array.isArray((object as Mesh).material)
      ? ((object as Mesh).material as MeshStandardMaterial[])
      : [(object as Mesh).material as MeshStandardMaterial];
    for (const material of materials) {
      names.push(material.name);
    }
  });
  return names;
};

describe('normalizeVehicleGltf', () => {
  it('leaves hatchback contract unchanged', () => {
    const root = buildHatchStub();
    normalizeVehicleGltf(root, 'hatchback');
    expect(root.getObjectByName('WheelFrontL')).toBeTruthy();
    expect(root.getObjectByName('BodyHood')).toBeTruthy();
  });

  it('maps logan wheels and lights onto four pivots', () => {
    const root = buildSedanStub();
    normalizeVehicleGltf(root, 'sedan');

    expect(root.getObjectByName('WheelFrontL')).toBeTruthy();
    expect(root.getObjectByName('WheelFrontR')).toBeTruthy();
    expect(root.getObjectByName('WheelRearL')).toBeTruthy();
    expect(root.getObjectByName('WheelRearR')).toBeTruthy();

    // Светильники Logan живут в атласе Kuzov1 — сплитим их по имени меша
    expect(materialNamesOn(root, 'Fara_1_low_glass_0')).toContain('Headlight');
    expect(materialNamesOn(root, 'Fara_lamp_low_Kuzov1_0')).toContain('Headlight');
    expect(materialNamesOn(root, 'Fonar_low_Kuzov1_0')).toContain('Brakelight');
    expect(materialNamesOn(root, 'Povorotnik_low_Kuzov1_0')).toContain('Signallight');

    // Панель кузова красится в синий и отвязывается от атласа
    const bodyMat = (root.getObjectByName('Kuzov_low_Kuzov1_0') as Mesh)
      .material as MeshStandardMaterial;
    expect(bodyMat.color.getHex()).toBe(SEDAN_BODY_COLOR);
    expect(bodyMat.map).toBeNull();
    expect(bodyMat.name).not.toBe('Kuzov1');

    // Бамперы красятся в цвет кузова — иначе атлас даёт красный низ
    for (const bumper of ['Bamper_pered_1_low_Kuzov1_0', 'Bamper_zad_1_low_Kuzov1_0']) {
      const bumperMat = (root.getObjectByName(bumper) as Mesh).material as MeshStandardMaterial;
      expect(bumperMat.name).toBe('SedanBodyPaint');
      expect(bumperMat.color.getHex()).toBe(SEDAN_BODY_COLOR);
      expect(bumperMat.map).toBeNull();
    }

    // То, что краситься не должно (шины/диски на пивотах), остаётся в атласе
    let tireMat: MeshStandardMaterial | null = null;
    root.getObjectByName('WheelFrontL')!.traverse((o) => {
      if (!tireMat && (o as Mesh).isMesh) {
        tireMat = (o as Mesh).material as MeshStandardMaterial;
      }
    });
    expect(tireMat!.name).toBe('Kuzov1');
    expect(tireMat!.color.getHex()).not.toBe(SEDAN_BODY_COLOR);
    expect(tireMat!.map).not.toBeNull();

    // Стёкла/корпуса света получают пониженный metalness (emissive читается ночью)
    const hlMat = (root.getObjectByName('Fara_1_low_glass_0') as Mesh)
      .material as MeshStandardMaterial;
    expect(hlMat.metalness).toBeLessThanOrEqual(0.2);
    expect(hlMat.emissiveIntensity).toBe(0);
    const blMat = (root.getObjectByName('Fonar_low_Kuzov1_0') as Mesh)
      .material as MeshStandardMaterial;
    expect(blMat.metalness).toBeLessThanOrEqual(0.2);
    expect(blMat.color.getHexString()).toBe('24080a');
    expect(blMat.map).toBeNull();
    expect(blMat.roughness).toBeLessThanOrEqual(0.25);
    expect(blMat.emissiveIntensity).toBe(0);
    const signalMat = (root.getObjectByName('Povorotnik_low_Kuzov1_0') as Mesh)
      .material as MeshStandardMaterial;
    expect(signalMat.color.getHexString()).toBe('3d200a');
    expect(signalMat.map).toBeNull();
    expect(signalMat.roughness).toBeLessThanOrEqual(0.25);
    expect(signalMat.emissiveIntensity).toBe(0);

    // Нос смотрит в +Z (контракт гонки)
    root.updateMatrixWorld(true);
    const hlZ = new Box3()
      .setFromObject(root.getObjectByName('Fara_lamp_low_Kuzov1_0')!)
      .getCenter(new Vector3()).z;
    const blZ = new Box3()
      .setFromObject(root.getObjectByName('Fonar_low_Kuzov1_0')!)
      .getCenter(new Vector3()).z;
    expect(hlZ).toBeGreaterThan(blZ);
  });

  it('splits combined RAM wheel meshes into four pivots', () => {
    const root = buildPickupStub();
    normalizeVehicleGltf(root, 'pickup');

    expect(root.getObjectByName('WheelFrontL')).toBeTruthy();
    expect(root.getObjectByName('WheelFrontR')).toBeTruthy();
    expect(root.getObjectByName('WheelRearL')).toBeTruthy();
    expect(root.getObjectByName('WheelRearR')).toBeTruthy();

    // Кузов перекрашен в бордовый (в GLB authored-синий) и получил глянец автолака
    const paintMat = (root.getObjectByName('PaintBody') as Mesh).material as MeshStandardMaterial;
    expect(paintMat.name).toBe('PickupBodyPaint');
    expect(paintMat.color.getHex()).toBe(PICKUP_BODY_COLOR);
    expect(paintMat.roughness).toBeLessThan(0.5);
    expect(materialNamesOn(root, 'LightGeo')).toContain('Headlight');
    expect(materialNamesOn(root, 'RedGlass')).toContain('Brakelight');
    expect(materialNamesOn(root, 'OrangeGlass')).toContain('Signallight');

    const brakeMat = (root.getObjectByName('RedGlass') as Mesh).material as MeshStandardMaterial;
    expect(brakeMat.color.getHexString()).toBe('24080a');
    expect(brakeMat.map).toBeNull();
    expect(brakeMat.roughness).toBeLessThanOrEqual(0.25);
    expect(brakeMat.emissive.getHexString()).toBe('ff0a0a');
    expect(brakeMat.emissiveIntensity).toBe(0);

    const signalMat = (root.getObjectByName('OrangeGlass') as Mesh)
      .material as MeshStandardMaterial;
    expect(signalMat.color.getHexString()).toBe('3d200a');
    expect(signalMat.map).toBeNull();
    expect(signalMat.emissiveIntensity).toBe(0);
    expect(signalMat.emissive.getHexString()).toBe('000000');

    expect(materialNamesUnder(root, 'WheelFrontL')).toContain(
      'RAM_1500TRX_2021_Wheel1A_3D_3DWheel2A_Material',
    );
  });

  it('maps juke compact wheels, hides combined layers and splits merged glass6', () => {
    const root = buildJukeStub();
    normalizeVehicleGltf(root, 'juke');
    attachJukeProceduralTires(root);

    expect(root.getObjectByName('WheelFrontL')).toBeTruthy();
    expect(root.getObjectByName('WheelFrontR')).toBeTruthy();
    expect(root.getObjectByName('WheelRearL')).toBeTruthy();
    expect(root.getObjectByName('WheelRearR')).toBeTruthy();
    expect(root.getObjectByName('CombinedWheelLayer')?.visible).toBe(false);
    expect(materialNamesOn(root, 'SignalStrip')).toContain('Headlight');
    expect(materialNamesOn(root, 'TaillightGlass')).toContain('Brakelight');
    expect(materialNamesUnder(root, 'WheelFrontL')).toContain('wheel1');

    // Torus TireFill (authored Matte полая — прячется)
    for (const name of ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR'] as const) {
      expect(materialNamesUnder(root, name)).toContain('Matte__FF2');
      expect(root.getObjectByName(`${name}_TireFill`), `${name}_TireFill`).toBeTruthy();
    }

    // Вне пивотов не должно быть видимой резины (иначе снова «два колеса»)
    let matteOutsideVisible = 0;
    root.traverse((object) => {
      if (!(object as Mesh).isMesh || !object.visible) {
        return;
      }
      const mesh = object as Mesh;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (!mats.some((m) => m.name === 'Matte__FF2')) {
        return;
      }
      let under = false;
      let p: Object3D | null = object;
      while (p) {
        if (
          p.name === 'WheelFrontL' ||
          p.name === 'WheelFrontR' ||
          p.name === 'WheelRearL' ||
          p.name === 'WheelRearR'
        ) {
          under = true;
          break;
        }
        p = p.parent;
      }
      if (!under) {
        matteOutsideVisible += 1;
      }
    });
    expect(matteOutsideVisible, 'no free-floating visible Matte tires').toBe(0);

    // Слитый meш glass6 разрезан: перед → Headlight, зад → Brakelight
    expect(root.getObjectByName('MergedLightGlass')).toBeFalsy();
    const frontGlass = root.getObjectByName('MergedLightGlass_Headlight');
    const rearGlass = root.getObjectByName('MergedLightGlass_Brakelight');
    expect(frontGlass).toBeTruthy();
    expect(rearGlass).toBeTruthy();
    expect(materialNamesOn(root, 'MergedLightGlass_Headlight')).toContain('Headlight');
    expect(materialNamesOn(root, 'MergedLightGlass_Brakelight')).toContain('Brakelight');

    // Нос в +Z: передний (фары) и задний (стекло фонарей) кластеры по своим бортам
    root.updateMatrixWorld(true);
    const frontZ = new Box3().setFromObject(frontGlass as Mesh).getCenter(new Vector3()).z;
    const rearZ = new Box3().setFromObject(rearGlass as Mesh).getCenter(new Vector3()).z;
    expect(frontZ).toBeGreaterThan(0);
    expect(rearZ).toBeLessThan(0);
    expect(frontZ).toBeGreaterThan(rearZ);
  });

  it('maps scirocco wheel.smd groups and light materials', () => {
    const root = buildSciroccoStub();
    normalizeVehicleGltf(root, 'scirocco');

    expect(root.getObjectByName('WheelFrontL')).toBeTruthy();
    expect(root.getObjectByName('WheelFrontR')).toBeTruthy();
    expect(root.getObjectByName('WheelRearL')).toBeTruthy();
    expect(root.getObjectByName('WheelRearR')).toBeTruthy();
    expect(materialNamesOn(root, 'BodyPaint')).toContain('skin_0.001');
    expect(materialNamesOn(root, 'HeadlightGlass')).toContain('Headlight');
    expect(materialNamesOn(root, 'TaillightGlass')).toContain('Brakelight');
    expect(materialNamesUnder(root, 'WheelFrontL')).toContain('tire');
  });

  it('bakes scirocco SkinnedMesh wheels into Mesh under pivots', () => {
    const root = buildSciroccoSkinnedStub();
    let skinnedBefore = 0;
    root.traverse((object) => {
      if ((object as SkinnedMesh).isSkinnedMesh === true) {
        skinnedBefore += 1;
      }
    });
    expect(skinnedBefore).toBeGreaterThanOrEqual(4);

    normalizeVehicleGltf(root, 'scirocco');

    for (const name of ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR'] as const) {
      const pivot = root.getObjectByName(name);
      expect(pivot, name).toBeTruthy();
      let skinnedUnder = 0;
      let meshUnder = 0;
      pivot!.traverse((object) => {
        if ((object as SkinnedMesh).isSkinnedMesh === true) {
          skinnedUnder += 1;
        } else if ((object as Mesh).isMesh === true) {
          meshUnder += 1;
        }
      });
      expect(skinnedUnder, `${name}: no SkinnedMesh after bake`).toBe(0);
      expect(meshUnder, `${name}: has baked Mesh`).toBeGreaterThan(0);
    }
    expect(materialNamesUnder(root, 'WheelFrontL')).toContain('tire');
  });

  it('keeps sedan axle span stable after normalize', () => {
    const root = buildSedanStub();
    const wbBefore = 1.7 - -1.5;

    normalizeVehicleGltf(root, 'sedan');
    root.updateMatrixWorld(true);
    const frontAfter = new Box3()
      .setFromObject(root.getObjectByName('WheelFrontL')!)
      .getCenter(new Vector3()).z;
    const rearAfter = new Box3()
      .setFromObject(root.getObjectByName('WheelRearL')!)
      .getCenter(new Vector3()).z;
    expect(frontAfter - rearAfter).toBeCloseTo(wbBefore, 5);
  });
});

describe('measureHeadlightLampPositions', () => {
  const fitFromRoot = (root: Group) => {
    root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(root);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    return computeVehicleFit({
      size: { x: size.x, y: size.y, z: size.z },
      min: { x: box.min.x, y: box.min.y, z: box.min.z },
      center: { x: center.x, y: center.y, z: center.z },
    });
  };

  it('splits a combined logan headlight mesh into left/right lamps near the nose', () => {
    const root = buildSedanStub();
    normalizeVehicleGltf(root, 'sedan');
    const fit = fitFromRoot(root);
    const lamps = measureHeadlightLampPositions(root, fit);
    expect(lamps).not.toBeNull();
    expect(lamps!.left[0]).toBeLessThan(0);
    expect(lamps!.right[0]).toBeGreaterThan(0);
    expect(lamps!.left[2]).toBeGreaterThan(1);
    expect(lamps!.right[2]).toBeGreaterThan(1);
    expect(Math.abs(lamps!.left[0] + lamps!.right[0])).toBeLessThan(0.05);
  });

  it('places separate scirocco headlights on their own sides', () => {
    const root = buildSciroccoStub();
    // Две отдельные фары L/R вместо одного стекла
    root.getObjectByName('HeadlightGlass')!.position.set(-0.5, 0.4, 1.7);
    const rightHl = new Mesh(
      new BoxGeometry(0.3, 0.1, 0.12),
      new MeshStandardMaterial({ name: 'headlight.001', color: '#fff8e0' }),
    );
    rightHl.name = 'HeadlightGlassR';
    rightHl.position.set(0.5, 0.4, 1.7);
    root.add(rightHl);

    normalizeVehicleGltf(root, 'scirocco');
    const fit = fitFromRoot(root);
    const lamps = measureHeadlightLampPositions(root, fit);
    expect(lamps).not.toBeNull();
    expect(lamps!.left[0]).toBeLessThan(-0.2);
    expect(lamps!.right[0]).toBeGreaterThan(0.2);
  });

  it('keeps cm-scale combined headlight lamps inside the body after fit', () => {
    // Как ram.glb: корень ×0.01, одно широкое стекло Headlight — без метрного
    // floor span лампы не должны перескакивать центр и уезжать на ±1.7 м.
    const root = new Group();
    root.scale.setScalar(0.01);
    const body = new Mesh(
      new BoxGeometry(2.5, 1.2, 5.9),
      new MeshStandardMaterial({ name: 'body', color: '#71121f' }),
    );
    root.add(body);
    const hl = new Mesh(
      new BoxGeometry(2.5, 0.3, 0.15),
      new MeshStandardMaterial({ name: 'Headlight', color: '#fff8e0' }),
    );
    hl.position.set(0, 0.5, 2.7);
    root.add(hl);
    root.updateMatrixWorld(true);

    const fit = fitFromRoot(root);
    expect(fit.scale).toBeGreaterThan(40);
    const lamps = measureHeadlightLampPositions(root, fit);
    expect(lamps).not.toBeNull();
    expect(lamps!.left[0]).toBeLessThan(0);
    expect(lamps!.right[0]).toBeGreaterThan(0);
    const halfSpan = (lamps!.right[0] - lamps!.left[0]) / 2;
    expect(halfSpan).toBeGreaterThan(0.2);
    expect(halfSpan).toBeLessThan(0.7);
    expect(Math.abs(lamps!.left[0] + lamps!.right[0])).toBeLessThan(0.05);
  });
});

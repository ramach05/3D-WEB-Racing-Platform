import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Object3D,
} from 'three';
import { normalizeVehicleGltf, measureHeadlightLampPositions } from './vehicle-body-variants';
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

/** Logan: 4 отдельные группы wheel*; фары сзади по −Z (как в реальном GLB) */
const buildSedanStub = (): Group => {
  const root = new Group();
  const paint = new MeshStandardMaterial({ name: 'kuzov', color: '#2244aa' });
  const headlight = new MeshStandardMaterial({
    name: 'fari',
    color: '#fff8e0',
    metalness: 1,
    roughness: 0.34,
  });
  const brakelightHousing = new MeshStandardMaterial({ name: 'sto1', color: '#440000' });
  const brakelightGlass = new MeshStandardMaterial({
    name: 'material_6',
    color: '#af0000',
    metalness: 1,
    emissive: '#ff0000',
    emissiveIntensity: 10,
  });
  const signal = new MeshStandardMaterial({ name: 'material_9', color: '#ff8c00' });
  const disk = new MeshStandardMaterial({ name: 'disk', color: '#888888' });
  const tire = new MeshStandardMaterial({ name: 'chernot', color: '#111111' });

  const bodyMesh = new Mesh(new BoxGeometry(1.8, 1.0, 4.2), paint);
  bodyMesh.name = 'BodyPaint';
  root.add(bodyMesh);
  const hl = new Mesh(new BoxGeometry(1.4, 0.1, 0.16), headlight);
  hl.name = 'HeadlightGlass';
  hl.position.set(0, 0.4, -2.0);
  root.add(hl);
  const tlGlass = new Mesh(new BoxGeometry(1.2, 0.1, 0.16), brakelightGlass);
  tlGlass.name = 'TaillightGlass';
  tlGlass.position.set(0, 0.4, 2.0);
  root.add(tlGlass);
  const tlHousing = new Mesh(new BoxGeometry(1.0, 0.08, 0.1), brakelightHousing);
  tlHousing.name = 'TaillightHousing';
  tlHousing.position.set(0, 0.4, 1.95);
  root.add(tlHousing);
  const signalMesh = new Mesh(new BoxGeometry(0.3, 0.05, 0.05), signal);
  signalMesh.name = 'SignalStrip';
  signalMesh.position.set(0.7, 0.4, 1.9);
  root.add(signalMesh);

  for (const [name, x, z] of [
    ['wheel001', 0.7, 1.2],
    ['wheel002', -0.7, 1.2],
    ['wheel', 0.7, -1.2],
    ['wheel003', -0.7, -1.2],
  ] as const) {
    const group = new Group();
    group.name = name;
    group.position.set(x, 0.27, z);
    root.add(group);
    group.add(new Mesh(new BoxGeometry(0.2, 0.5, 0.5), tire));
    group.add(new Mesh(new BoxGeometry(0.12, 0.35, 0.35), disk));
  }

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

/** Juke: compact individual wheels + one combined layer to hide */
const buildJukeStub = (): Group => {
  const root = new Group();
  const bodyMat = new MeshStandardMaterial({ name: 'body1', color: '#cc2200' });
  const wheelMat = new MeshStandardMaterial({ name: 'wheel1', color: '#111111' });
  const signal = new MeshStandardMaterial({ name: 'orange', color: '#ff8800' });
  const brakelight = new MeshStandardMaterial({ name: 'material_15', color: '#cc0000' });
  const headlight = new MeshStandardMaterial({ name: 'glass6', color: '#aa9900' });

  root.add(new Mesh(new BoxGeometry(1.6, 1.0, 3.8), bodyMat));
  const signalMesh = new Mesh(new BoxGeometry(1.4, 0.05, 0.05), signal);
  signalMesh.name = 'SignalStrip';
  root.add(signalMesh);
  const bl = new Mesh(new BoxGeometry(1.0, 0.08, 0.1), brakelight);
  bl.name = 'TaillightGlass';
  bl.position.set(0, 0.4, -1.8);
  root.add(bl);
  const hl = new Mesh(new BoxGeometry(1.2, 0.12, 0.1), headlight);
  hl.name = 'HeadlightGlass';
  hl.position.set(0, 0.45, 1.85);
  root.add(hl);

  for (const [x, z] of [
    [0.7, 1.1],
    [-0.7, 1.1],
    [0.7, -1.1],
    [-0.7, -1.1],
  ] as const) {
    const wheel = new Mesh(new BoxGeometry(0.25, 0.5, 0.5), wheelMat);
    wheel.position.set(x, 0.25, z);
    root.add(wheel);
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

    expect(materialNamesOn(root, 'BodyPaint')).toContain('kuzov');
    expect(materialNamesOn(root, 'HeadlightGlass')).toContain('Headlight');
    expect(materialNamesOn(root, 'TaillightGlass')).toContain('Brakelight');
    expect(materialNamesOn(root, 'TaillightHousing')).toContain('Brakelight');
    expect(materialNamesOn(root, 'SignalStrip')).toContain('Signallight');
    expect(materialNamesUnder(root, 'WheelFrontL')).toContain('chernot');

    const hlMat = (root.getObjectByName('HeadlightGlass') as Mesh).material as MeshStandardMaterial;
    expect(hlMat.metalness).toBeLessThanOrEqual(0.2);
    const blMat = (root.getObjectByName('TaillightGlass') as Mesh).material as MeshStandardMaterial;
    expect(blMat.metalness).toBeLessThanOrEqual(0.2);

    // Нос смотрит в +Z (контракт гонки), даже если GLB был развёрнут
    root.updateMatrixWorld(true);
    const hlZ = new Box3()
      .setFromObject(root.getObjectByName('HeadlightGlass')!)
      .getCenter(new Vector3()).z;
    const blZ = new Box3()
      .setFromObject(root.getObjectByName('TaillightGlass')!)
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

    expect(materialNamesOn(root, 'PaintBody')).toContain('RAM_1500TRX_2021Paint_Material');
    expect(materialNamesOn(root, 'LightGeo')).toContain('Headlight');
    expect(materialNamesOn(root, 'RedGlass')).toContain('Brakelight');
    expect(materialNamesOn(root, 'OrangeGlass')).toContain('Signallight');
    expect(materialNamesUnder(root, 'WheelFrontL')).toContain(
      'RAM_1500TRX_2021_Wheel1A_3D_3DWheel2A_Material',
    );
  });

  it('maps juke compact wheels and hides combined layers', () => {
    const root = buildJukeStub();
    normalizeVehicleGltf(root, 'juke');

    expect(root.getObjectByName('WheelFrontL')).toBeTruthy();
    expect(root.getObjectByName('WheelFrontR')).toBeTruthy();
    expect(root.getObjectByName('WheelRearL')).toBeTruthy();
    expect(root.getObjectByName('WheelRearR')).toBeTruthy();
    expect(root.getObjectByName('CombinedWheelLayer')?.visible).toBe(false);
    expect(materialNamesOn(root, 'SignalStrip')).toContain('Signallight');
    expect(materialNamesOn(root, 'TaillightGlass')).toContain('Brakelight');
    expect(materialNamesOn(root, 'HeadlightGlass')).toContain('Headlight');
    expect(materialNamesUnder(root, 'WheelFrontL')).toContain('wheel1');
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

  it('keeps sedan axle span stable after normalize', () => {
    const root = buildSedanStub();
    const wbBefore = 1.2 - -1.2;

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
});

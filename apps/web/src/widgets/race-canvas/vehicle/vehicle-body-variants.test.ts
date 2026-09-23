import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Object3D,
} from 'three';
import { applyVehicleBodyVariant } from './vehicle-body-variants';
import { describe, expect, it } from 'vitest';

/** Стенд с identity-иерархией */
const buildCarStub = (): Group => {
  const root = new Group();
  const paint = new MeshStandardMaterial({ name: 'Paint 1 Carmine', color: '#cc0000' });
  const headlight = new MeshStandardMaterial({ name: 'Headlight', color: '#fff8e0' });
  const brakelight = new MeshStandardMaterial({ name: 'Brakelight', color: '#ff0000' });
  const rim = new MeshStandardMaterial({ name: 'Rim1', color: '#888888' });
  const underside = new Group();
  underside.name = 'BodyUnderside';
  root.add(underside);

  const addPart = (
    name: string,
    parent: Object3D = underside,
    pos: [number, number, number] = [0, 0.5, 0],
    size: [number, number, number] = [0.5, 0.3, 0.5],
    material: MeshStandardMaterial = paint,
  ) => {
    const mesh = new Mesh(new BoxGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...pos);
    parent.add(mesh);
    return mesh;
  };

  const hood = addPart('BodyHood', underside, [0, 0.7, 1.5], [1.5, 0.4, 1.2]);
  addPart('BodyHoodTopgrill', hood, [0, 0.1, 0]);
  addPart('BodyHeadlights', hood, [0, 0, 0.2], [1.0, 0.15, 0.1], headlight);
  addPart('BodyRoofPanel', underside, [0, 1.0, 0], [1.0, 0.05, 0.7]);
  addPart('BodyRearPanelsColor1', underside, [0, 0.6, -1.2], [1.5, 0.6, 1.2]);
  addPart('BodyPillars', underside, [0, 0.9, 0.2], [1.5, 0.8, 1.2]);
  addPart('BodyDoorLColor1', underside, [0.7, 0.6, 0], [0.3, 0.7, 1.2]);
  addPart('BodyDoorRColor1', underside, [-0.7, 0.6, 0], [0.3, 0.7, 1.2]);
  addPart('BodyDoorLColor2', underside, [0.7, 0.55, 0], [0.2, 0.5, 1.0]);
  addPart('BodyDoorRColor2', underside, [-0.7, 0.55, 0], [0.2, 0.5, 1.0]);
  addPart('BodyWindshield', underside, [0, 0.9, 0.6], [1.2, 0.3, 0.8]);
  addPart('BodyWindshieldGasket', underside, [0, 0.88, 0.6], [1.25, 0.28, 0.82]);
  addPart('BodyPanelsColor2', underside, [0, 0.3, 0.2], [1.6, 0.25, 3.5]);
  addPart('InteriorSeatsColor1', underside, [0, 0.5, -0.1], [1.2, 0.6, 1.5]);
  addPart('InteriorFloor', underside, [0, 0.2, 0], [1.4, 0.05, 2.5]);
  addPart('Engine', underside, [0, 0.45, 1.8], [0.8, 0.4, 0.6]);
  addPart('BodyTaillights', underside, [0, 0.8, -1.7], [1.0, 0.05, 0.1], brakelight);

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
    const tire = new Mesh(new BoxGeometry(0.3, 0.6, 0.6), paint);
    tire.name = `${name}Tire`;
    wheel.add(tire);
    const rimMesh = new Mesh(new BoxGeometry(0.2, 0.4, 0.4), rim);
    rimMesh.name = `${name}Rim`;
    wheel.add(rimMesh);
  }

  return root;
};

const measureSize = (root: Object3D) => {
  root.updateMatrixWorld(true);
  return new Box3().setFromObject(root).getSize(new Vector3());
};

const wheelCenterZ = (root: Object3D, name: string) => {
  const wheel = root.getObjectByName(name);
  if (!wheel) {
    return Number.NaN;
  }
  root.updateMatrixWorld(true);
  return new Box3().setFromObject(wheel).getCenter(new Vector3()).z;
};

const partMaxY = (root: Object3D, name: string) => {
  const node = root.getObjectByName(name);
  if (!node) {
    return 0;
  }
  root.updateMatrixWorld(true);
  return new Box3().setFromObject(node).max.y;
};

describe('applyVehicleBodyVariant', () => {
  it('leaves hatchback unchanged', () => {
    const root = buildCarStub();
    const hoodGeo = (root.getObjectByName('BodyHood') as Mesh).geometry;
    applyVehicleBodyVariant(root, 'hatchback');
    expect(root.scale.x).toBe(1);
    expect(root.scale.y).toBe(1);
    expect(root.scale.z).toBe(1);
    expect(root.getObjectByName('BodyDoorLColor1')?.visible).toBe(true);
    expect((root.getObjectByName('BodyHood') as Mesh).geometry).toBe(hoodGeo);
  });

  it('builds a solid sedan: shorter wheelbase, intact cabin, light overlays', () => {
    const root = buildCarStub();
    const hoodMesh = root.getObjectByName('BodyHood') as Mesh;
    const sharedGeo = hoodMesh.geometry;
    const wbBefore = wheelCenterZ(root, 'WheelFrontL') - wheelCenterZ(root, 'WheelRearL');
    const lengthBefore = measureSize(root).z;
    const roofYBefore = partMaxY(root, 'BodyRoofPanel');

    applyVehicleBodyVariant(root, 'sedan');

    expect(root.scale.x).toBe(1);
    expect(root.scale.y).toBe(1);
    expect(root.scale.z).toBe(1);
    expect(hoodMesh.geometry).not.toBe(sharedGeo);
    expect(root.getObjectByName('BodyDoorLColor1')?.visible).toBe(true);
    expect(root.getObjectByName('BodyRoofPanel')?.visible).toBe(true);
    expect(root.getObjectByName('BodyHeadlights')?.visible).toBe(true);
    expect(root.getObjectByName('SedanHeadlightL')).toBeTruthy();
    expect(root.getObjectByName('SedanTailBar')).toBeTruthy();
    expect(root.getObjectByName('BuggyRollCage')).toBeUndefined();

    const wbAfter = wheelCenterZ(root, 'WheelFrontL') - wheelCenterZ(root, 'WheelRearL');
    expect(wbAfter).toBeLessThan(wbBefore * 0.98);
    // Крыша почти как у хэтча — не раздавливаем кабину
    expect(partMaxY(root, 'BodyRoofPanel')).toBeGreaterThan(roofYBefore * 0.9);
    expect(measureSize(root).z).toBeCloseTo(lengthBefore, 1);
  });

  it('builds a solid pickup: longer wheelbase, bed rails, no floating cage', () => {
    const root = buildCarStub();
    const wbBefore = wheelCenterZ(root, 'WheelFrontL') - wheelCenterZ(root, 'WheelRearL');
    const roofYBefore = partMaxY(root, 'BodyRoofPanel');
    const hoodGeo = (root.getObjectByName('BodyHood') as Mesh).geometry;

    applyVehicleBodyVariant(root, 'pickup');

    expect(root.scale.x).toBe(1);
    expect(root.scale.y).toBe(1);
    expect(root.scale.z).toBe(1);
    expect((root.getObjectByName('BodyHood') as Mesh).geometry).not.toBe(hoodGeo);
    expect(root.getObjectByName('BodyDoorLColor1')?.visible).toBe(true);
    expect(root.getObjectByName('BodyHood')?.visible).toBe(true);
    expect(root.getObjectByName('BodyRoofPanel')?.visible).toBe(true);
    expect(root.getObjectByName('PickupRailL')).toBeTruthy();
    expect(root.getObjectByName('PickupBedFloor')).toBeTruthy();
    expect(root.getObjectByName('BuggyRollCage')).toBeUndefined();
    expect(root.getObjectByName('CageMainTop')).toBeUndefined();

    const wbAfter = wheelCenterZ(root, 'WheelFrontL') - wheelCenterZ(root, 'WheelRearL');
    expect(wbAfter).toBeGreaterThan(wbBefore * 1.02);
    // Крыша целая, без экстремального подъёма
    expect(partMaxY(root, 'BodyRoofPanel')).toBeGreaterThan(roofYBefore * 0.95);
    expect(partMaxY(root, 'BodyRoofPanel')).toBeLessThan(roofYBefore * 1.2);
  });
});

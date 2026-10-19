import { type RefObject, Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  Box3,
  Color,
  Group,
  MathUtils,
  Quaternion,
  Vector3,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { TCarSkin } from '@/entities/track';
import {
  getVehicle,
  getVehicleFitTargetLength,
  HATCHBACK_GLTF_PATH,
  VEHICLES,
  type TVehicleId,
} from '@/entities/vehicle';
import { vehiclePalette } from '@/shared/config';
import {
  attachJukeProceduralTires,
  attachJukeTiresToRimPose,
  normalizeVehicleGltf,
  resolveHeadlightLampPositions,
  VEHICLE_VARIANT_REV,
  type THeadlightLamps,
} from '@/widgets/race-canvas/vehicle/vehicle-body-variants';
import { computeVehicleFit, type TVehicleFit } from '@/widgets/race-canvas/vehicle/vehicle-fit';
import { VehicleModelFallback } from '@/widgets/race-canvas/vehicle/vehicle-model-fallback';
import {
  rearLightEmissiveIntensity,
  resolveRearLightMode,
  type TRearLightMode,
} from '@/widgets/race-canvas/vehicle/vehicle-rear-lights';
import {
  computeAckermannScale,
  computeAxleLocal,
  computeSteerAxisLocal,
  computeToeYawCorrection,
  measureWheelAxle,
} from '@/widgets/race-canvas/vehicle/vehicle-wheel-rig';

/** Preloads all garage GLBs (tracks / race / garage) */
export const preloadVehicleModel = () => {
  for (const vehicle of VEHICLES) {
    useGLTF.preload(vehicle.gltfPath);
  }
};

/** Max front wheel steer angle (rad ≈ 32°) */
const MAX_STEER_ANGLE = 0.56;
/** Steering smoothing rate (MathUtils.damp lambda) */
const STEER_DAMP = 14;
/** Fallback wheel radius before fit — for spin from forwardSpeed */
const MODEL_WHEEL_RADIUS = 0.42;
const HEADLIGHT_EMISSIVE_ON = 1.8;
/** By day headlights are fully off (no warm "lit" glass) */
const HEADLIGHT_EMISSIVE_OFF = 0;

const FRONT_WHEEL_NAMES = ['WheelFrontL', 'WheelFrontR'] as const;
const REAR_WHEEL_NAMES = ['WheelRearL', 'WheelRearR'] as const;
const HIDDEN_NODE_NAMES = ['InteriorSteeringEmblem'] as const;

const tmpBox = new Box3();
const tmpCenter = new Vector3();
const tmpColor = new Color();
const tmpQuat = new Quaternion();

type TWheelRig = {
  /** Steer pivot around world vertical (in parent axes) */
  steerPivot: Group;
  /** Spin pivot around the tire axis through the wheel center */
  spinPivot: Group;
  /** Steer axis in the parent's local space (= world up) */
  steerAxisLocal: Vector3;
  /** Tire axis in spinPivot space (rest) */
  axleLocal: Vector3;
  /** +1 left (+X), −1 right — for Ackermann */
  sideSign: number;
  /** Front wheel */
  isFront: boolean;
};

export type TVehicleDriveVisual = {
  /** Forward speed m/s */
  forwardSpeed: number;
  /** Steering −1…1 (+ = left) */
  steer: number;
  /** Brake 0…1 */
  brake: number;
  /** Visual kerb rumble 0…1 (applied externally on the visual group) */
  kerbRumble: number;
};

type TVehicleModelProps = {
  /** Body chosen in the garage */
  vehicleId: TVehicleId;
  /** Track skin */
  carSkin: TCarSkin;
  /** Night headlights */
  headlightsOn: boolean;
  /** Speed / steering / brake from the physics frame */
  driveVisualRef: RefObject<TVehicleDriveVisual>;
  /** Spotlight positions from the Headlight meshes (written by VehicleModel) */
  headlightLampsRef?: RefObject<THeadlightLamps | null>;
};

type TPreparedVehicle = {
  cloned: Group;
  rigs: TWheelRig[];
  fit: TVehicleFit;
  brakeMaterials: MeshStandardMaterial[];
  /** Wheel radius in model units (before fit.scale) */
  wheelRadius: number;
  /** Spotlights in chassis space after fit */
  headlightLamps: THeadlightLamps;
};

const isMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true;

const isStandardMaterial = (material: Material): material is MeshStandardMaterial =>
  (material as MeshStandardMaterial).isMeshStandardMaterial === true;

/** Clones the mesh materials so skins don't spoil the useGLTF cache */
const cloneMeshMaterials = (mesh: Mesh) => {
  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map((material) => material.clone());
    return;
  }
  mesh.material = mesh.material.clone();
};

/** Hides Khronos logo nodes */
const hideBrandingNodes = (root: Object3D) => {
  for (const name of HIDDEN_NODE_NAMES) {
    const node = root.getObjectByName(name);
    if (node) {
      node.visible = false;
    }
  }
};

/** Pivot hierarchy: steer (world-up) → align (toe neutralization) → spin (tire axis) → wheel. attach preserves the authored world matrix before the toe correction. */
const buildWheelRig = (wheel: Object3D, isFront: boolean): TWheelRig | null => {
  const parent = wheel.parent;
  if (!parent) {
    return null;
  }

  parent.updateMatrixWorld(true);
  wheel.updateMatrixWorld(true);

  tmpBox.setFromObject(wheel);
  tmpBox.getCenter(tmpCenter);
  parent.worldToLocal(tmpCenter);

  const steerAxisLocal = computeSteerAxisLocal(parent.getWorldQuaternion(tmpQuat));

  const steerPivot = new Group();
  steerPivot.name = `${wheel.name}_steer`;
  steerPivot.position.copy(tmpCenter);
  parent.add(steerPivot);

  const alignPivot = new Group();
  alignPivot.name = `${wheel.name}_align`;
  steerPivot.add(alignPivot);

  const spinPivot = new Group();
  spinPivot.name = `${wheel.name}_spin`;
  alignPivot.add(spinPivot);

  // attach preserves the world matrix at build time
  spinPivot.attach(wheel);

  // The tire axis is measured from geometry: on models with identity nodes the wheel node
  // carries no rotation and toe is baked into the vertices — wheel.getWorldQuaternion() can't reveal it.
  const wheelAxleWorld = measureWheelAxle(wheel);
  const yawCorr = computeToeYawCorrection(wheelAxleWorld);
  if (Math.abs(yawCorr) > 1e-5) {
    alignPivot.quaternion.setFromAxisAngle(steerAxisLocal, yawCorr);
  }

  // Tire axis in the spin pivot's local axes. measureWheelAxle returns a direction with
  // x ≥ 0 (both sides spin forward with a shared spinAngle), but in world space.
  // The spinPivot.quaternion rotation runs in the pivot's local frame (= the parent's
  // frame), so the world axis must be brought into this frame — otherwise on models under
  // a rotated parent (CarConcept's BodyUnderside, −90° around X) the wheel spins around
  // a "foreign" axis (chaotic rotation). For root pivots (sedan/pickup) the conversion is identity.
  const axleLocal = computeAxleLocal(wheelAxleWorld, parent.getWorldQuaternion(tmpQuat));
  // Left wheel is on +X
  const sideSign = tmpCenter.x >= 0 ? 1 : -1;

  return {
    steerPivot,
    spinPivot,
    steerAxisLocal,
    axleLocal,
    sideSign,
    isFront,
  };
};

/** Applies skin colors to paint / interior / tire (hatchback only) */
const applyCarSkin = (root: Object3D, carSkin: TCarSkin) => {
  root.traverse((object) => {
    if (!isMesh(object)) {
      return;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!isStandardMaterial(material)) {
        continue;
      }
      const name = material.name;
      if (name.startsWith('Paint')) {
        material.color.set(carSkin.body);
        // Otherwise map overrides the track color
        material.map = null;
        material.needsUpdate = true;
        continue;
      }
      if (name.startsWith('Interior') || name === 'Dashboard' || name === 'Floormat') {
        tmpColor.set(carSkin.cabin);
        material.color.copy(tmpColor);
        continue;
      }
      if (name === 'Tireside' || name === 'Tiretread') {
        material.color.set(carSkin.wheel);
        material.map = null;
        material.needsUpdate = true;
      }
    }
  });
};

/** Toggles castShadow on opaque meshes */
const setCastShadow = (root: Object3D, castShadow: boolean) => {
  root.traverse((object) => {
    if (!isMesh(object)) {
      return;
    }
    object.castShadow = castShadow;
    object.receiveShadow = true;
  });
};

/** Configures headlight emissive per night mode */
const setHeadlightEmissive = (root: Object3D, headlightsOn: boolean) => {
  root.traverse((object) => {
    if (!isMesh(object)) {
      return;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!isStandardMaterial(material)) {
        continue;
      }
      if (material.name !== 'Headlight') {
        continue;
      }
      if (headlightsOn) {
        material.emissive.set(vehiclePalette.headlampEmissive);
        material.emissiveIntensity = HEADLIGHT_EMISSIVE_ON;
      } else {
        material.emissive.set('#000000');
        material.emissiveIntensity = HEADLIGHT_EMISSIVE_OFF;
      }
    }
  });
};

/** Collects brake light materials once after cloning. Only Brakelight — Signallight (indicators/amber) doesn't take part in brake/reverse. */
const collectBrakeMaterials = (root: Object3D): MeshStandardMaterial[] => {
  const result: MeshStandardMaterial[] = [];
  root.traverse((object) => {
    if (!isMesh(object)) {
      return;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!isStandardMaterial(material)) {
        continue;
      }
      if (material.name !== 'Brakelight') {
        continue;
      }
      // Lens polycarbonate: dark red + gloss (not satin / not "paint")
      material.color.set(vehiclePalette.brakeGlass);
      material.map = null;
      material.metalness = 0.12;
      material.roughness = 0.2;
      material.envMapIntensity = 1.35;
      material.emissive.set(vehiclePalette.brakeEmissive);
      material.emissiveMap = null;
      material.emissiveIntensity = 0;
      material.needsUpdate = true;
      result.push(material);
    }
  });
  return result;
};

/** Emissive color for a rear light mode */
const rearLightEmissiveColor = (mode: TRearLightMode): string => {
  if (mode === 'reverse') {
    return vehiclePalette.reverseEmissive;
  }
  return vehiclePalette.brakeEmissive;
};

/** Updates rear light color/brightness. Color changes only on mode switch (cheaper than setting it every frame). */
const setRearLightEmissive = (
  materials: MeshStandardMaterial[],
  mode: TRearLightMode,
  brake: number,
  headlightsOn: boolean,
  lastMode: { current: TRearLightMode | null },
) => {
  const intensity = rearLightEmissiveIntensity(mode, brake, headlightsOn);
  const modeChanged = lastMode.current !== mode;
  if (modeChanged) {
    lastMode.current = mode;
    const color = rearLightEmissiveColor(mode);
    for (const material of materials) {
      material.emissive.set(color);
      material.emissiveIntensity = intensity;
    }
    return;
  }
  for (const material of materials) {
    material.emissiveIntensity = intensity;
  }
};

/** Imperative wheel and rear-light animation (outside React render rules) */
const applyWheelAnimation = (
  wheelRigs: TWheelRig[],
  brakeMaterials: MeshStandardMaterial[],
  steerAngle: number,
  spinAngle: number,
  brake: number,
  forwardSpeed: number,
  headlightsOn: boolean,
  lastRearLightMode: { current: TRearLightMode | null },
) => {
  for (const wheelRig of wheelRigs) {
    if (wheelRig.isFront) {
      const angle = steerAngle * computeAckermannScale(steerAngle, wheelRig.sideSign);
      wheelRig.steerPivot.quaternion.setFromAxisAngle(wheelRig.steerAxisLocal, angle);
    }
    wheelRig.spinPivot.quaternion.setFromAxisAngle(wheelRig.axleLocal, spinAngle);
  }
  const mode = resolveRearLightMode(brake, forwardSpeed);
  setRearLightEmissive(brakeMaterials, mode, brake, headlightsOn, lastRearLightMode);
};

/** Computes fit from the clone's visible meshes (a hidden GLB body doesn't affect the frame) */
const measureFit = (root: Object3D, targetLength?: number): TVehicleFit => {
  root.updateMatrixWorld(true);
  tmpBox.makeEmpty();
  root.traverse((object) => {
    if (!isMesh(object) || !object.visible) {
      return;
    }
    tmpBox.expandByObject(object);
  });
  if (tmpBox.isEmpty()) {
    tmpBox.setFromObject(root);
  }
  const size = tmpBox.getSize(new Vector3());
  const center = tmpBox.getCenter(new Vector3());
  return computeVehicleFit(
    {
      size: { x: size.x, y: size.y, z: size.z },
      min: { x: tmpBox.min.x, y: tmpBox.min.y, z: tmpBox.min.z },
      center: { x: center.x, y: center.y, z: center.z },
    },
    targetLength,
  );
};

/** Wheel radius estimate from bbox (half of the smaller side in the YZ plane) */
const measureWheelRadius = (root: Object3D): number => {
  const wheel = root.getObjectByName('WheelFrontL') ?? root.getObjectByName('WheelRearL');
  if (!wheel) {
    return MODEL_WHEEL_RADIUS;
  }
  root.updateMatrixWorld(true);
  tmpBox.setFromObject(wheel);
  const size = tmpBox.getSize(tmpCenter);
  const diameter = Math.min(size.y, size.z);
  // No clamping in model units: for mini-scaled models (ram.glb —
  // the whole car ~0.06, wheel diameter ~0.009) the old 0.12 clamp after × fitScale (~55)
  // gave an effective radius of ~6.6 m → spin ~24x too slow. The lower bound on the
  // WORLD radius (wheelRadius × fitScale) is set by the spin calc: Math.max(…, 0.05).
  return Math.max(diameter * 0.5, 1e-4);
};

/** Clones the body, normalizes names, builds wheel-rigs and fit */
const prepareVehicleRoot = (
  source: Group,
  vehicleId: TVehicleId,
  hideBranding: boolean,
): TPreparedVehicle => {
  const cloned = cloneSkinned(source) as Group;
  cloned.traverse((object) => {
    if (isMesh(object)) {
      cloneMeshMaterials(object);
    }
  });
  if (hideBranding) {
    hideBrandingNodes(cloned);
  }
  normalizeVehicleGltf(cloned, vehicleId);

  // Juke: tires onto pivots BEFORE rig — the authored tire pose matches the rims' baked toe,
  // so align/steer/spin rotate rim and tire as a single assembly. Then the tor fallback.
  if (vehicleId === 'juke') {
    attachJukeTiresToRimPose(cloned);
    attachJukeProceduralTires(cloned);
  }

  const rigs: TWheelRig[] = [];
  for (const name of FRONT_WHEEL_NAMES) {
    const wheel = cloned.getObjectByName(name);
    if (wheel) {
      const rig = buildWheelRig(wheel, true);
      if (rig) {
        rigs.push(rig);
      }
    }
  }
  for (const name of REAR_WHEEL_NAMES) {
    const wheel = cloned.getObjectByName(name);
    if (wheel) {
      const rig = buildWheelRig(wheel, false);
      if (rig) {
        rigs.push(rig);
      }
    }
  }

  const fit = measureFit(cloned, getVehicleFitTargetLength(vehicleId));
  return {
    cloned,
    rigs,
    fit,
    brakeMaterials: collectBrakeMaterials(cloned),
    wheelRadius: measureWheelRadius(cloned),
    headlightLamps: resolveHeadlightLampPositions(cloned, fit, vehicleId),
  };
};

/** Skins + wheel/light animation for a prepared body */
const usePreparedVehicleVisuals = (
  prepared: TPreparedVehicle,
  vehicleId: TVehicleId,
  carSkin: TCarSkin,
  headlightsOn: boolean,
  driveVisualRef: RefObject<TVehicleDriveVisual>,
) => {
  const steerAngleRef = useRef(0);
  const spinAngleRef = useRef(0);
  const rigsRef = useRef<TWheelRig[]>([]);
  const brakeMaterialsRef = useRef<MeshStandardMaterial[]>([]);
  const rearLightModeRef = useRef<TRearLightMode | null>(null);
  const headlightsOnRef = useRef(headlightsOn);
  const fitScaleRef = useRef(1);
  const wheelRadiusRef = useRef(0.42);

  useLayoutEffect(() => {
    rigsRef.current = prepared.rigs;
    brakeMaterialsRef.current = prepared.brakeMaterials;
    rearLightModeRef.current = null;
    headlightsOnRef.current = headlightsOn;
    fitScaleRef.current = prepared.fit.scale;
    wheelRadiusRef.current = prepared.wheelRadius;
    // Bodies are painted in normalize: pickup — maroon, Logan — blue
    if (vehicleId === 'hatchback') {
      applyCarSkin(prepared.cloned, carSkin);
    }
    setCastShadow(prepared.cloned, !headlightsOn);
    setHeadlightEmissive(prepared.cloned, headlightsOn);
  }, [prepared, vehicleId, carSkin, headlightsOn]);

  useFrame((_, dt) => {
    const drive = driveVisualRef.current;
    if (!drive) {
      return;
    }
    const clampedDt = Math.min(dt, 1 / 20);
    const targetSteer = drive.steer * MAX_STEER_ANGLE;
    steerAngleRef.current = MathUtils.damp(
      steerAngleRef.current,
      targetSteer,
      STEER_DAMP,
      clampedDt,
    );

    const wheelRadius = wheelRadiusRef.current * fitScaleRef.current;
    spinAngleRef.current += (drive.forwardSpeed / Math.max(wheelRadius, 0.05)) * clampedDt;

    applyWheelAnimation(
      rigsRef.current,
      brakeMaterialsRef.current,
      steerAngleRef.current,
      spinAngleRef.current,
      drive.brake,
      drive.forwardSpeed,
      headlightsOnRef.current,
      rearLightModeRef,
    );
  });
};

/** A separate GLB per body + wheel/material name normalization */
const GltfVehicleModelInner = ({
  vehicleId,
  carSkin,
  headlightsOn,
  driveVisualRef,
  headlightLampsRef,
}: TVehicleModelProps) => {
  const gltfPath = getVehicle(vehicleId)?.gltfPath ?? HATCHBACK_GLTF_PATH;
  const { scene } = useGLTF(gltfPath);
  const prepared = useMemo(
    () => prepareVehicleRoot(scene as Group, vehicleId, vehicleId === 'hatchback'),
    // VEHICLE_VARIANT_REV — so HMR of the normalization rebuilds the clone
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rev is intentional bust
    [scene, vehicleId, VEHICLE_VARIANT_REV],
  );
  usePreparedVehicleVisuals(prepared, vehicleId, carSkin, headlightsOn, driveVisualRef);

  useLayoutEffect(() => {
    if (!headlightLampsRef) {
      return;
    }
    headlightLampsRef.current = prepared.headlightLamps;
  }, [prepared, headlightLampsRef]);

  const { fit } = prepared;

  return (
    <group scale={fit.scale} position={[fit.offset.x, fit.offset.y, fit.offset.z]}>
      <primitive object={prepared.cloned} />
    </group>
  );
};

/** Body: a separate GLB per vehicleId */
export const VehicleModel = (props: TVehicleModelProps) => (
  <Suspense fallback={<VehicleModelFallback carSkin={props.carSkin} />}>
    <GltfVehicleModelInner {...props} />
  </Suspense>
);

preloadVehicleModel();

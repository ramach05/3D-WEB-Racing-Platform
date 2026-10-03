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
import {
  computeVehicleFit,
  type TVehicleFit,
} from '@/widgets/race-canvas/vehicle/vehicle-fit';
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

/** Прогревает все GLB гаража (tracks / race / garage) */
export const preloadVehicleModel = () => {
  for (const vehicle of VEHICLES) {
    useGLTF.preload(vehicle.gltfPath);
  }
};

/** Максимальный угол поворота передних колёс (рад ≈ 32°) */
const MAX_STEER_ANGLE = 0.56;
/** Скорость сглаживания руля (MathUtils.damp lambda) */
const STEER_DAMP = 14;
/** Fallback радиус колеса до fit — для spin от forwardSpeed */
const MODEL_WHEEL_RADIUS = 0.42;
const HEADLIGHT_EMISSIVE_ON = 1.8;
/** Днём фары полностью выкл. (без тёплого «подсвеченного» стекла) */
const HEADLIGHT_EMISSIVE_OFF = 0;

const FRONT_WHEEL_NAMES = ['WheelFrontL', 'WheelFrontR'] as const;
const REAR_WHEEL_NAMES = ['WheelRearL', 'WheelRearR'] as const;
const HIDDEN_NODE_NAMES = ['InteriorSteeringEmblem'] as const;

const tmpBox = new Box3();
const tmpCenter = new Vector3();
const tmpColor = new Color();
const tmpQuat = new Quaternion();

type TWheelRig = {
  /** Pivot руления вокруг мировой вертикали (в осях родителя) */
  steerPivot: Group;
  /** Pivot вращения вокруг оси шины через центр колеса */
  spinPivot: Group;
  /** Ось руления в локальном пространстве родителя (= world up) */
  steerAxisLocal: Vector3;
  /** Ось шины в пространстве spinPivot (rest) */
  axleLocal: Vector3;
  /** +1 левое (+X), −1 правое — для Ackermann */
  sideSign: number;
  /** Переднее колесо */
  isFront: boolean;
};

export type TVehicleDriveVisual = {
  /** Продольная скорость м/с */
  forwardSpeed: number;
  /** Руль −1…1 (влево +) */
  steer: number;
  /** Тормоз 0…1 */
  brake: number;
  /** Визуальный rumble поребрика 0…1 (применяется снаружи на visual group) */
  kerbRumble: number;
};

type TVehicleModelProps = {
  /** Выбранный кузов из гаража */
  vehicleId: TVehicleId;
  /** Скин трассы */
  carSkin: TCarSkin;
  /** Ночные фары */
  headlightsOn: boolean;
  /** Скорость / руль / тормоз с кадра физики */
  driveVisualRef: RefObject<TVehicleDriveVisual>;
  /** Позиции прожекторов по мешам Headlight (пишет VehicleModel) */
  headlightLampsRef?: RefObject<THeadlightLamps | null>;
};

type TPreparedVehicle = {
  cloned: Group;
  rigs: TWheelRig[];
  fit: TVehicleFit;
  brakeMaterials: MeshStandardMaterial[];
  /** Радиус колеса в единицах модели (до fit.scale) */
  wheelRadius: number;
  /** Прожекторы в пространстве шасси после fit */
  headlightLamps: THeadlightLamps;
};

const isMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true;

const isStandardMaterial = (material: Material): material is MeshStandardMaterial =>
  (material as MeshStandardMaterial).isMeshStandardMaterial === true;

/** Клонирует материалы меша, чтобы скины не портили кэш useGLTF */
const cloneMeshMaterials = (mesh: Mesh) => {
  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map((material) => material.clone());
    return;
  }
  mesh.material = mesh.material.clone();
};

/** Прячет ноды-логотипы Khronos */
const hideBrandingNodes = (root: Object3D) => {
  for (const name of HIDDEN_NODE_NAMES) {
    const node = root.getObjectByName(name);
    if (node) {
      node.visible = false;
    }
  }
};

/**
 * Pivot-иерархия: steer (world-up) → align (нейтрализация toe) → spin (ось шины) → wheel.
 * attach сохраняет authored world matrix до коррекции toe.
 */
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

  // attach сохраняет world matrix на момент сборки
  spinPivot.attach(wheel);

  // Ось шины мерим по геометрии: у моделей с identity-нодами узел колёс ничем не
  // повёрнут, а toe запечён в вершины — из wheel.getWorldQuaternion() его не достать.
  const wheelAxleWorld = measureWheelAxle(wheel);
  const yawCorr = computeToeYawCorrection(wheelAxleWorld);
  if (Math.abs(yawCorr) > 1e-5) {
    alignPivot.quaternion.setFromAxisAngle(steerAxisLocal, yawCorr);
  }

  // Ось шины в локальных осях пивота вращения. measureWheelAxle возвращает направление с
  // x ≥ 0 (обе стороны крутятся общим spinAngle вперёд), но в мировом пространстве.
  // Вращение spinPivot.quaternion выполняется в локальном фрейме пивота (= фрейм
  // родителя), поэтому мировую ось нужно привести в этот фрейм — иначе у моделей под
  // повёрнутым родителем (BodyUnderside у CarConcept, −90° по X) колесо крутится вокруг
  // «чужой» оси (хаотичное вращение). У корневых пивотов (sedan/pickup) конверсия тождественна.
  const axleLocal = computeAxleLocal(wheelAxleWorld, parent.getWorldQuaternion(tmpQuat));
  // Левое колесо на +X
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

/** Применяет цвета скина к paint / interior / tire (только хэтчбек) */
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
        // Иначе map перебивает цвет трассы
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

/** Включает/выключает castShadow на непрозрачных мешах */
const setCastShadow = (root: Object3D, castShadow: boolean) => {
  root.traverse((object) => {
    if (!isMesh(object)) {
      return;
    }
    object.castShadow = castShadow;
    object.receiveShadow = true;
  });
};

/** Настраивает emissive фар по ночному режиму */
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

/**
 * Собирает материалы стопов один раз после клонирования.
 * Только Brakelight — Signallight (поворотники/янтарь) не участвует в brake/reverse.
 */
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
      // Поликарбонат линзы: тёмный красный + глянец (не атлас / не «краска»)
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

/** Цвет emissive для режима задних огней */
const rearLightEmissiveColor = (mode: TRearLightMode): string => {
  if (mode === 'reverse') {
    return vehiclePalette.reverseEmissive;
  }
  return vehiclePalette.brakeEmissive;
};

/**
 * Обновляет цвет/яркость задних огней.
 * Цвет меняется только при смене режима (дешевле set каждый кадр).
 */
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

/** Imperative-анимация колёс и задних огней (вне React render rules) */
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

/** Считает fit по видимым мешам клона (спрятанный GLB-кузов не влияет на кадр) */
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

/** Оценка радиуса колеса по bbox (половина меньшей стороны в плоскости YZ) */
const measureWheelRadius = (root: Object3D): number => {
  const wheel = root.getObjectByName('WheelFrontL') ?? root.getObjectByName('WheelRearL');
  if (!wheel) {
    return MODEL_WHEEL_RADIUS;
  }
  root.updateMatrixWorld(true);
  tmpBox.setFromObject(wheel);
  const size = tmpBox.getSize(tmpCenter);
  const diameter = Math.min(size.y, size.z);
  // Не клампим в модельных единицах: для мини-масштабированных моделей (ram.glb —
  // вся машина ~0.06, диаметр колеса ~0.009) старый кламп 0.12 после × fitScale (~55)
  // давал эффективный радиус ~6.6 м → spin в ~24 раза медленнее. Нижний предел на
  // МИРОВОМ радиусе (wheelRadius × fitScale) ставит spin-расчёт: Math.max(…, 0.05).
  return Math.max(diameter * 0.5, 1e-4);
};

/** Клонирует кузов, нормализует имена, собирает wheel-rig и fit */
const prepareVehicleRoot = (
  source: Group,
  vehicleId: TVehicleId,
  hideBranding: boolean,
): TPreparedVehicle => {
  // eslint-disable-next-line no-console -- ревизия нормализации: видно в консоли, какой код исполняет вкладка
  console.debug('[vehicle-normalize]', vehicleId, 'rev', VEHICLE_VARIANT_REV);
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

  // Juke: резина на пивоты ДО rig — authored-поза резины согласована с baked-toe
  // дисков, и align/steer/spin крутят диск с покрышкой единым узлом. Затем тор-fallback.
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

/** Скины + анимация колёс/огней для подготовленного кузова */
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
    // Кузова красятся в normalize: пикап — бордовый, Logan — синий
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

/** Отдельный GLB на кузов + нормализация имён колёс/материалов */
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
    // VEHICLE_VARIANT_REV — чтобы HMR нормализации пересобрал клон
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

/** Кузов: отдельный GLB на каждый vehicleId */
export const VehicleModel = (props: TVehicleModelProps) => (
  <Suspense fallback={<VehicleModelFallback carSkin={props.carSkin} />}>
    <GltfVehicleModelInner {...props} />
  </Suspense>
);

preloadVehicleModel();

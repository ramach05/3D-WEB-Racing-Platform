import { type RefObject, useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useRapier } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { Quaternion, Vector3 } from 'three';
import type { Group, Object3D, SpotLight } from 'three';
import type { TCarSkin, TLoopPoint, TOrientedBox, TVec3 } from '@/entities/track';
import type { TVehicleId } from '@/entities/vehicle';
import {
  IDLE_DRIVE_SFX_SAMPLE,
  mapOilSlapFromSpeed,
  mapWallScrape,
  pulseDriveOilSlap,
  resetDriveSfx,
  tickDriveSfxSample,
} from '@/features/race-audio';
import {
  computeRescueImpulse,
  isRescueActive,
  isStuckAgainstObstacle,
  RESCUE_NOSE_OFFSET,
  RESCUE_RADIUS,
  updateStuckTimer,
} from '@/widgets/race-canvas/lib/anti-stuck';
import { pulseCameraShake } from '@/widgets/race-canvas/lib/camera-shake';
import {
  beginCountdown,
  computeGroundFollowVy,
  computeSlopePitchFromNormal,
  computeSteerStrength,
  dampLateralVelocity,
  getDriveInput,
  getRaceHudSnapshot,
  GROUND_NORMAL_MIN_Y,
  integrateDriveForward,
  integrateSteerYaw,
  passedCheckpointZone,
  setVehiclePose,
  smoothAngleToward,
  SLOPE_CONTACT_NORMAL_MIN_Y,
  tickRace,
  VEHICLE_MAX_SPEED,
  VEHICLE_REVERSE_MAX,
} from '@/features/race-session';
import { vehiclePalette } from '@/shared/config';
import {
  GROUND_PROBE_GROUPS,
  OBSTACLE_PROBE_GROUPS,
  TIRE_GROUPS,
  VEHICLE_GROUPS,
  WALL_PROBE_GROUPS,
} from '@/widgets/race-canvas/lib/collision-groups';
import {
  applyOilThrottleFactor,
  computeOilSkidIntensity,
  computeOilYawKick,
  resetOilGrip,
  resolveOilSurfaceGrip,
  tickOilGrip,
} from '@/widgets/race-canvas/lib/oil-grip';
import { ROAD_TOP_Y } from '@/widgets/race-canvas/lib/road-ribbon-geometry';
import {
  computeSkidIntensity,
  SKID_SMOKE_THRESHOLD,
} from '@/widgets/race-canvas/lib/skid-intensity';
import { pushSkidSample, pushSkidSmoke } from '@/widgets/race-canvas/lib/skid-marks-store';
import {
  resetTireHitDamping,
  tickTireHitDamping,
} from '@/widgets/race-canvas/lib/tire-hit-damping';
import {
  aggregateWheelSurfaces,
  applyOffroadThrottleFactor,
  combineSurfaceGrip,
  computeKerbRumble,
  computeOffroadFxStrength,
  sampleAsphaltMicroGrip,
  sampleTrackSurfaceKind,
  type TTrackSurfaceKind,
} from '@/widgets/race-canvas/lib/track-surface';
import {
  headlightLocalPositions,
  type THeadlightLamps,
} from '@/widgets/race-canvas/vehicle/vehicle-body-variants';
import {
  VehicleModel,
  type TVehicleDriveVisual,
} from '@/widgets/race-canvas/vehicle/vehicle-model';

type TSkidWheelPos = { x: number; z: number };

/** Физические канделы — левая и правая фары (с запасом под decay=2) */
const HEADLIGHT_INTENSITY = 75;
const HEADLIGHT_ANGLE = 0.42;
const HEADLIGHT_PENUMBRA = 0.7;
const HEADLIGHT_DISTANCE = 24;
const HEADLIGHT_DECAY = 2;
/** Прицел: в плоскость асфальта впереди */
const HEADLIGHT_TARGET: TVec3 = [0, -1.0, 11];
/** Одна shadowed-фара × 768² вместо двух — главный shadow hotspot ночи */
const HEADLIGHT_SHADOW_MAP = 768;
const HEADLIGHT_SHADOW_NEAR = 0.5;
const HEADLIGHT_SHADOW_BIAS = -0.00002;
const HEADLIGHT_SHADOW_NORMAL_BIAS = 0.015;
/** fov shadow camera ≈ 2 × spot angle (градусы) — без пустого frustum */
const HEADLIGHT_SHADOW_FOV = (2 * HEADLIGHT_ANGLE * 180) / Math.PI;
/** scratch для decompose мировой матрицы кузова в фарах */
const tmpHeadlightScale = new Vector3();

type TVehicleProps = {
  /** Позиция спавна на трассе */
  spawnPosition: TVec3;
  /** Угол поворота при спавне (рад) */
  spawnRotationY: number;
  /** Счётчик рестарта гонки */
  resetNonce: number;
  /** Ref физического тела Rapier */
  bodyRef: RefObject<RapierRigidBody | null>;
  /** Ref визуальной группы кузова */
  visualRef: RefObject<Group | null>;
  /** Выбранный кузов из гаража */
  vehicleId: TVehicleId;
  /** Раскраска кузова / кабины / колёс */
  carSkin: TCarSkin;
  /** Включить фары (ночь) */
  headlightsOn: boolean;
  /** Зоны луж масла на трассе */
  oilSlicks: TOrientedBox[];
  /** Центровая линия трассы */
  centerline: TLoopPoint[];
  /** Ширина дороги */
  roadWidth: number;
  /** Ширины дороги по точкам (опционально) */
  roadWidths?: number[];
  /** Дождь: дым от старта с места заменяется водным спреем */
  isRain: boolean;
};

type TVehicleHeadlightsProps = {
  /** Визуальная группа кузова: интерполированная rapier-ом поза + визуальный attitude */
  visualRef: RefObject<Group | null>;
  /** Кузов — fallback, пока GLB не отдал измеренные лампы */
  vehicleId: TVehicleId;
  /** Позиции из VehicleModel (меши Headlight после fit) */
  headlightLampsRef: RefObject<THeadlightLamps | null>;
};

/** Настраивает shadow map только у левой фары */
const configureHeadlightShadow = (light: SpotLight) => {
  light.castShadow = true;
  light.shadow.mapSize.set(HEADLIGHT_SHADOW_MAP, HEADLIGHT_SHADOW_MAP);
  light.shadow.bias = HEADLIGHT_SHADOW_BIAS;
  light.shadow.normalBias = HEADLIGHT_SHADOW_NORMAL_BIAS;
  light.shadow.camera.near = HEADLIGHT_SHADOW_NEAR;
  light.shadow.camera.far = HEADLIGHT_DISTANCE;
  light.shadow.camera.fov = HEADLIGHT_SHADOW_FOV;
  light.shadow.camera.updateProjectionMatrix();
};

/** Фары вне RigidBody — иначе shadow map SpotLight не окклюдирует стены */
const VehicleHeadlights = ({
  visualRef,
  vehicleId,
  headlightLampsRef,
}: TVehicleHeadlightsProps) => {
  const groupRef = useRef<Group>(null);
  const headlightTargetRef = useRef<Object3D>(null);
  const leftHeadlightRef = useRef<SpotLight>(null);
  const rightHeadlightRef = useRef<SpotLight>(null);
  const fallbackLamps = headlightLocalPositions(vehicleId);

  /** Привязывает aim-target; тень только у левой фары */
  const bindTargets = () => {
    const aim = headlightTargetRef.current;
    const left = leftHeadlightRef.current;
    const right = rightHeadlightRef.current;
    if (!aim) {
      return;
    }
    aim.updateMatrixWorld();
    if (left) {
      if (left.target !== aim) {
        left.target = aim;
      }
      configureHeadlightShadow(left);
    }
    if (right && right.target !== aim) {
      right.target = aim;
    }
  };

  // Привязывает aim-target к фарам после монтирования.
  useLayoutEffect(() => {
    bindTargets();
  }, []);

  // Жестко фиксирует группу фар в позе кузова: без сглаживания,
  // чтобы свет не смещался относительно машины при разгоне/торможении.
  useFrame(() => {
    const visual = visualRef.current;
    const group = groupRef.current;
    if (!visual || !group) {
      return;
    }
    visual.updateWorldMatrix(true, false);
    visual.matrixWorld.decompose(group.position, group.quaternion, tmpHeadlightScale);
    const lamps = headlightLampsRef.current ?? fallbackLamps;
    const left = leftHeadlightRef.current;
    const right = rightHeadlightRef.current;
    if (left) {
      left.position.set(lamps.left[0], lamps.left[1], lamps.left[2]);
    }
    if (right) {
      right.position.set(lamps.right[0], lamps.right[1], lamps.right[2]);
    }
    const aim = headlightTargetRef.current;
    if (!aim) {
      return;
    }
    aim.updateMatrixWorld();
    if (left && left.target !== aim) {
      left.target = aim;
    }
    if (right && right.target !== aim) {
      right.target = aim;
    }
  });

  return (
    <group ref={groupRef}>
      <object3D ref={headlightTargetRef} position={HEADLIGHT_TARGET} />
      <spotLight
        ref={leftHeadlightRef}
        position={fallbackLamps.left}
        angle={HEADLIGHT_ANGLE}
        penumbra={HEADLIGHT_PENUMBRA}
        intensity={HEADLIGHT_INTENSITY}
        distance={HEADLIGHT_DISTANCE}
        decay={HEADLIGHT_DECAY}
        color={vehiclePalette.headlight}
        castShadow
        shadow-mapSize-width={HEADLIGHT_SHADOW_MAP}
        shadow-mapSize-height={HEADLIGHT_SHADOW_MAP}
        shadow-bias={HEADLIGHT_SHADOW_BIAS}
        shadow-normalBias={HEADLIGHT_SHADOW_NORMAL_BIAS}
        shadow-camera-near={HEADLIGHT_SHADOW_NEAR}
        shadow-camera-far={HEADLIGHT_DISTANCE}
        shadow-camera-fov={HEADLIGHT_SHADOW_FOV}
      />
      <spotLight
        ref={rightHeadlightRef}
        position={fallbackLamps.right}
        angle={HEADLIGHT_ANGLE}
        penumbra={HEADLIGHT_PENUMBRA}
        intensity={HEADLIGHT_INTENSITY}
        distance={HEADLIGHT_DISTANCE}
        decay={HEADLIGHT_DECAY}
        color={vehiclePalette.headlight}
        castShadow={false}
      />
    </group>
  );
};

const WHEEL_LOCAL: TVec3[] = [
  [-0.72, 0.05, 1.05],
  [0.72, 0.05, 1.05],
  [-0.72, 0.05, -1.05],
  [0.72, 0.05, -1.05],
];

/**
 * Сетка probes под днищем: капсула кузова заметно больше стопки шин (1.2×1.2),
 * колесные лучи пролетают мимо — опору под кузовом ищем по всей подошве капсулы.
 */
const OBSTACLE_PROBE_POINTS: TVec3[] = [-0.7, 0, 0.7].flatMap((px) =>
  [-1.5, -0.75, 0, 0.75, 1.5].map((pz) => [px, 0.05, pz] as TVec3),
);

const MAX_SPEED = VEHICLE_MAX_SPEED;
const REVERSE_MAX = VEHICLE_REVERSE_MAX;
/** Горизонтальная капсула ≈ габариты кузова: гладкое скольжение вдоль стен */
const COLLIDER_HALF_X = 0.82;
const COLLIDER_HALF_Z = 1.65;
const COLLIDER_RADIUS = COLLIDER_HALF_X;
const COLLIDER_HALF_HEIGHT = COLLIDER_HALF_Z - COLLIDER_RADIUS;
const COLLIDER_Y = COLLIDER_RADIUS;
/** Запас луча за край коллайдера для раннего slide */
const WALL_PROBE_MARGIN = 0.2;
/** Look-ahead (с): удлиняет probe на скорость «в стену», ~2–3 кадра @ 60 fps */
const WALL_PROBE_LOOKAHEAD = 0.04;
/** Высота спавна над точкой старта — машина падает на трассу */
const SPAWN_DROP_HEIGHT = 3.2;
/** После касания ждём почти нулевую вертикальную скорость */
const LAND_SETTLE_VY = 1.2;

/**
 * Длина луча-зонда под колесом. Достает до земли с запасом ~1.5м (капсула + корпус ≈ 1.8м над треком).
 * Оставляем достаточно коротким, чтобы не цеплять далекие стены.
 */
const WHEEL_GROUND_RAY = 2.5;
/**
 * Попадание считается контактом колеса с дорогой только если оно ближе этого порога (м).
 * Капсула на высоте ~1.8м над треком → расстояние до земли ≈ 1.5-2.0м.
 * TOI > 2.5м — это стена/откос, а не дорога.
 */
const GROUND_PROBE_TOI = 2.8;
/** Запас «на земли» после последней точки контакта — перекрывает краткий отрыв на гребне */
const GROUNDED_GRACE_SECONDS = 0.15;
/** Допуск высоты над дорогой: выше — это подброс, возвращаем тело на трассу */
const GROUND_SNAP_TOLERANCE = 0.25;

/** Поднимает точку спавна на SPAWN_DROP_HEIGHT над асфальтом */
const elevatedSpawn = (spawnPosition: TVec3): { x: number; y: number; z: number } => ({
  x: spawnPosition[0],
  y: spawnPosition[1] + SPAWN_DROP_HEIGHT,
  z: spawnPosition[2],
});

const tmpForward = new Vector3();
const tmpRight = new Vector3();
const tmpVel = new Vector3();
const tmpQuat = new Quaternion();
const tmpOrigin = new Vector3();
const tmpDesired = new Vector3();
const tmpNormal = new Vector3();
const tmpSlide = new Vector3();
const tmpGroundNormal = new Vector3();

/** Скользит вдоль стены: убирает составляющую скорости по нормали стены */
const slideAlongWalls = (
  world: ReturnType<typeof useRapier>['world'],
  rapier: ReturnType<typeof useRapier>['rapier'],
  body: RapierRigidBody,
  velocity: Vector3,
): Vector3 => {
  const translation = body.translation();
  const rotation = body.rotation();
  tmpQuat.set(rotation.x, rotation.y, rotation.z, rotation.w);
  tmpForward.set(0, 0, 1).applyQuaternion(tmpQuat);
  tmpRight.set(1, 0, 0).applyQuaternion(tmpQuat);

  const probes = [tmpForward, tmpForward.clone().negate(), tmpRight, tmpRight.clone().negate()];

  const result = velocity.clone();

  for (const dir of probes) {
    // dir — луч к стене; удлиняем probe при движении навстречу
    const intoProbe = Math.max(0, velocity.dot(dir));
    if (intoProbe < 0.01) {
      continue;
    }
    const probeLen =
      Math.abs(dir.dot(tmpForward)) * COLLIDER_HALF_Z +
      Math.abs(dir.dot(tmpRight)) * COLLIDER_HALF_X +
      WALL_PROBE_MARGIN +
      intoProbe * WALL_PROBE_LOOKAHEAD;
    const ray = new rapier.Ray(
      { x: translation.x, y: translation.y + COLLIDER_Y, z: translation.z },
      { x: dir.x, y: 0, z: dir.z },
    );
    const hit = world.castRayAndGetNormal(
      ray,
      probeLen,
      true,
      undefined,
      WALL_PROBE_GROUPS,
      undefined,
      body,
    );
    if (!hit) {
      continue;
    }
    // Нормаль стены (не ось машины) — иначе под углом обнуляется весь forward
    tmpNormal.set(hit.normal.x, 0, hit.normal.z);
    if (tmpNormal.lengthSq() < 0.001) {
      continue;
    }
    tmpNormal.normalize();
    // Нормаль должна смотреть навстречу лучу (из стены к машине)
    if (tmpNormal.dot(dir) > 0) {
      tmpNormal.negate();
    }
    const intoWall = result.dot(tmpNormal);
    if (intoWall < 0) {
      tmpSlide.copy(tmpNormal).multiplyScalar(intoWall);
      result.sub(tmpSlide);
    }
  }

  return result;
};

/** Проезд колеса через любую oriented-box зону с subsample между кадрами. */
const isWheelOnAnyZone = (
  prevX: number | null,
  prevZ: number | null,
  x: number,
  z: number,
  zones: TOrientedBox[],
): boolean => {
  for (const zone of zones) {
    if (passedCheckpointZone(prevX, prevZ, x, z, zone)) {
      return true;
    }
  }
  return false;
};

/** Arcade-машина: отзывчивое руление, скольжение вдоль стен */
export const Vehicle = ({
  spawnPosition,
  spawnRotationY,
  resetNonce,
  bodyRef,
  visualRef,
  vehicleId,
  carSkin,
  headlightsOn,
  oilSlicks,
  centerline,
  roadWidth,
  roadWidths,
  isRain,
}: TVehicleProps) => {
  const { world, rapier } = useRapier();
  const lastNonce = useRef(resetNonce);
  const awaitingLand = useRef(true);
  const groundedGrace = useRef(0);
  const lastGroundNormal = useRef({ x: 0, y: 1, z: 0 });
  const visPitch = useRef(0);
  const lastSkidPos = useRef<(TSkidWheelPos | null)[]>([null, null, null, null]);
  const smokeTimer = useRef(0);
  const dirtSmokeTimer = useRef(0);
  const prevZoneWheelPos = useRef<(TSkidWheelPos | null)[]>([null, null, null, null]);
  const prevWheelsOnOil = useRef(0);
  const kerbPhase = useRef(0);
  const kerbShakeCooldown = useRef(0);
  const stuckTimer = useRef(0);
  const driveVisualRef = useRef<TVehicleDriveVisual>({
    forwardSpeed: 0,
    steer: 0,
    brake: 0,
    kerbRumble: 0,
  });
  const headlightLampsRef = useRef<THeadlightLamps | null>(null);

  const clearSkidTrail = () => {
    lastSkidPos.current = [null, null, null, null];
    smokeTimer.current = 0;
    dirtSmokeTimer.current = 0;
  };

  // Визуальный attitude кузова: наклон по склону + тряска керба. Крена в повороте нет —
  // наклон корпуса на повороте выглядел нереалистично. Пишется только в дочернюю
  // визуальную группу — физическое тело остается плоским (вращения только вокруг Y).
  const applyVisualAttitude = (pitchTarget: number, kerbShakePitch: number, dt: number) => {
    visPitch.current = smoothAngleToward(visPitch.current, pitchTarget, dt);
    const visual = visualRef.current;
    if (visual) {
      visual.rotation.x = visPitch.current + kerbShakePitch;
    }
  };

  // Arcade-физика: рестарт, ввод, grip и скольжение вдоль стен.
  useFrame((_, dt) => {
    const body = bodyRef.current;
    if (!body) {
      return;
    }

    if (lastNonce.current !== resetNonce) {
      lastNonce.current = resetNonce;
      awaitingLand.current = true;
      resetTireHitDamping();
      resetOilGrip();
      resetDriveSfx();
      prevZoneWheelPos.current = [null, null, null, null];
      prevWheelsOnOil.current = 0;
      kerbPhase.current = 0;
      kerbShakeCooldown.current = 0;
      stuckTimer.current = 0;
      driveVisualRef.current.kerbRumble = 0;
      clearSkidTrail();
      visPitch.current = 0;
      groundedGrace.current = 0;
      const visual = visualRef.current;
      if (visual) {
        visual.position.y = 0;
        visual.rotation.x = 0;
        visual.rotation.z = 0;
      }
      body.setTranslation(elevatedSpawn(spawnPosition), true);
      body.setRotation(
        { x: 0, y: Math.sin(spawnRotationY / 2), z: 0, w: Math.cos(spawnRotationY / 2) },
        true,
      );
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    const rotation = body.rotation();
    tmpQuat.set(rotation.x, rotation.y, rotation.z, rotation.w);
    tmpForward.set(0, 0, 1).applyQuaternion(tmpQuat);
    tmpRight.set(1, 0, 0).applyQuaternion(tmpQuat);

    const linvel = body.linvel();
    tmpVel.set(linvel.x, linvel.y, linvel.z);
    const speed = Math.hypot(linvel.x, linvel.z);
    tickRace(speed * 3.6);

    const translation = body.translation();
    setVehiclePose(translation.x, translation.z, Math.atan2(tmpForward.x, tmpForward.z));
    let wheelGrounded = false;
    let rampContact = false;
    let groundNormalCount = 0;
    let roadYSum = 0;
    let roadYCount = 0;
    // Препятствие (стопка шин) под днищем: снап к дороге и кламп вертикали запрещены —
    // иначе телепорт внутрь коллайдеров = тряска/зависание. Ищется сеткой ниже.
    let obstacleContact = false;
    tmpGroundNormal.set(0, 0, 0);
    for (const offset of WHEEL_LOCAL) {
      tmpOrigin.set(offset[0], offset[1], offset[2]).applyQuaternion(tmpQuat);
      tmpOrigin.x += translation.x;
      tmpOrigin.y += translation.y;
      tmpOrigin.z += translation.z;
      const ray = new rapier.Ray(
        { x: tmpOrigin.x, y: tmpOrigin.y, z: tmpOrigin.z },
        { x: 0, y: -1, z: 0 },
      );
      // Только мир (дорога/стены): контакт с бочкой/шиной не должен считаться опорой
      // и отключать кламп вертикальной скорости — иначе препятствие подбрасывает машину.
      const hit = world.castRayAndGetNormal(
        ray,
        WHEEL_GROUND_RAY,
        true,
        undefined,
        GROUND_PROBE_GROUPS,
        undefined,
        body,
      );
      if (hit) {
        // Близкое попадание почти на горизонтальную поверхность = реальный контакт;
        // дальнее — машина в воздухе, почти вертикальная нормаль — стена, а не земля.
        if (hit.timeOfImpact <= GROUND_PROBE_TOI && hit.normal.y >= GROUND_NORMAL_MIN_Y) {
          wheelGrounded = true;
          roadYSum += tmpOrigin.y - hit.timeOfImpact;
          roadYCount += 1;
        }
        // Трамплин = реальный уклон (14–20°); нормаль стены не должна отключать
        // кламп вертикальной скорости, иначе удар в ограждение подбрасывает машину.
        if (hit.normal.y < 0.97 && hit.normal.y >= SLOPE_CONTACT_NORMAL_MIN_Y) {
          rampContact = true;
        }
        if (hit.normal.y >= SLOPE_CONTACT_NORMAL_MIN_Y) {
          tmpGroundNormal.x += hit.normal.x;
          tmpGroundNormal.y += hit.normal.y;
          tmpGroundNormal.z += hit.normal.z;
          groundNormalCount += 1;
        }
      }
    }
    if (groundNormalCount > 0) {
      tmpGroundNormal.multiplyScalar(1 / groundNormalCount);
      if (tmpGroundNormal.lengthSq() > 1e-6) {
        tmpGroundNormal.normalize();
      } else {
        tmpGroundNormal.set(0, 1, 0);
      }
      lastGroundNormal.current = {
        x: tmpGroundNormal.x,
        y: tmpGroundNormal.y,
        z: tmpGroundNormal.z,
      };
      groundedGrace.current = GROUNDED_GRACE_SECONDS;
    } else {
      groundedGrace.current = Math.max(0, groundedGrace.current - Math.min(dt, 1 / 30));
      if (groundedGrace.current > 0) {
        tmpGroundNormal.set(
          lastGroundNormal.current.x,
          lastGroundNormal.current.y,
          lastGroundNormal.current.z,
        );
      } else {
        tmpGroundNormal.set(0, 1, 0);
      }
    }
    const grounded = wheelGrounded || groundedGrace.current > 0 || translation.y < 2.5;

    const hud = getRaceHudSnapshot();
    const input = getDriveInput();
    const forwardSpeed = tmpVel.dot(tmpForward);
    driveVisualRef.current.forwardSpeed = hud.status === 'racing' ? forwardSpeed : 0;
    driveVisualRef.current.steer = input.steer;
    driveVisualRef.current.brake = input.brake;

    if (awaitingLand.current && hud.status === 'ready') {
      if (wheelGrounded && Math.abs(linvel.y) < LAND_SETTLE_VY) {
        awaitingLand.current = false;
        beginCountdown();
      }
      tickDriveSfxSample(IDLE_DRIVE_SFX_SAMPLE);
      return;
    }

    if (hud.status !== 'racing') {
      clearSkidTrail();
      driveVisualRef.current.kerbRumble = 0;
      tickDriveSfxSample(IDLE_DRIVE_SFX_SAMPLE);
      return;
    }

    const clampedDt = Math.min(dt, 1 / 30);
    if (!grounded) {
      clearSkidTrail();
      driveVisualRef.current.kerbRumble = 0;
      const visual = visualRef.current;
      if (visual) {
        visual.position.y = 0;
      }
      // В воздухе — кузов плавно возвращается к ровному (наклон → 0).
      applyVisualAttitude(0, 0, clampedDt);
      tickDriveSfxSample({
        ...IDLE_DRIVE_SFX_SAMPLE,
        active: true,
        speedMs: speed,
        throttle: input.throttle,
        brake: input.brake,
        handbrake: input.handbrake,
        grounded: false,
      });
      return;
    }

    // Детект поверхностей / масла по каждому колесу.
    const wheelOnOil: boolean[] = [false, false, false, false];
    const wheelKinds: TTrackSurfaceKind[] = ['asphalt', 'asphalt', 'asphalt', 'asphalt'];
    let wheelsOnOil = 0;
    let microSum = 0;
    for (let i = 0; i < WHEEL_LOCAL.length; i += 1) {
      const offset = WHEEL_LOCAL[i]!;
      tmpOrigin.set(offset[0], offset[1], offset[2]).applyQuaternion(tmpQuat);
      const wx = tmpOrigin.x + translation.x;
      const wz = tmpOrigin.z + translation.z;
      const prevWheel = prevZoneWheelPos.current[i];
      const onOil = isWheelOnAnyZone(prevWheel?.x ?? null, prevWheel?.z ?? null, wx, wz, oilSlicks);
      wheelOnOil[i] = onOil;
      if (onOil) {
        wheelsOnOil += 1;
      }
      wheelKinds[i] = sampleTrackSurfaceKind(wx, wz, centerline, roadWidth, roadWidths);
      microSum += sampleAsphaltMicroGrip(wx, wz);
      prevZoneWheelPos.current[i] = { x: wx, z: wz };
    }
    const surfaces = aggregateWheelSurfaces(wheelKinds);
    const asphaltMicro = microSum / WHEEL_LOCAL.length;
    const oilStrength = tickOilGrip(wheelsOnOil / WHEEL_LOCAL.length, clampedDt);
    const oilSurfaceGrip = resolveOilSurfaceGrip(oilStrength);
    const surfaceGrip = combineSurfaceGrip(
      oilSurfaceGrip,
      surfaces.offroad,
      surfaces.kerb,
      asphaltMicro,
    );
    const offroadFx = computeOffroadFxStrength(surfaces.offroad, forwardSpeed);
    const kerbRumble = computeKerbRumble(surfaces.kerb, forwardSpeed);
    driveVisualRef.current.kerbRumble = kerbRumble;

    if (prevWheelsOnOil.current === 0 && wheelsOnOil > 0) {
      const slap = mapOilSlapFromSpeed(speed);
      pulseDriveOilSlap(slap);
      pulseCameraShake(slap);
    }
    prevWheelsOnOil.current = wheelsOnOil;

    let kerbShakePitch = 0;
    const visual = visualRef.current;
    if (kerbRumble > 0) {
      kerbPhase.current += clampedDt * (6 + speed * 0.35);
      kerbShakeCooldown.current = Math.max(0, kerbShakeCooldown.current - clampedDt);
      if (kerbShakeCooldown.current <= 0) {
        pulseCameraShake(0.08 + kerbRumble * 0.22);
        kerbShakeCooldown.current = 0.09 - kerbRumble * 0.035;
      }
      const amp = 0.018 + kerbRumble * 0.022;
      if (visual) {
        visual.position.y = Math.sin(kerbPhase.current * 18) * amp;
      }
      // Наклон тряски добавится к визуальному наклону склона в applyVisualAttitude.
      kerbShakePitch = Math.sin(kerbPhase.current * 23) * amp * 0.55;
    } else {
      kerbPhase.current = 0;
      kerbShakeCooldown.current = 0;
      if (visual) {
        visual.position.y = 0;
      }
    }

    let targetForward = integrateDriveForward(forwardSpeed, {
      throttle: input.throttle,
      brake: input.brake,
      handbrake: input.handbrake,
      dt: clampedDt,
    });

    targetForward = applyOilThrottleFactor(
      forwardSpeed,
      targetForward,
      input.throttle,
      oilStrength,
    );
    targetForward = applyOffroadThrottleFactor(
      forwardSpeed,
      targetForward,
      input.throttle,
      surfaces.offroad,
    );
    targetForward = Math.max(-REVERSE_MAX, Math.min(MAX_SPEED, targetForward));
    targetForward *= tickTireHitDamping(clampedDt);

    const lateral = tmpVel.dot(tmpRight);
    const dampedLateral = dampLateralVelocity(
      lateral,
      input.handbrake,
      input.throttle,
      clampedDt,
      surfaceGrip,
    );

    const skid = computeSkidIntensity({
      brake: input.brake,
      throttle: input.throttle,
      handbrake: input.handbrake,
      forwardSpeed,
      lateral,
      grounded: wheelGrounded,
    });
    // Intensity следа масла для колеса, которое сейчас на луже (не residual).
    const oilSkidActive = wheelsOnOil > 0 ? computeOilSkidIntensity(1, forwardSpeed) : 0;
    const offroadSkidBoost = offroadFx * 0.35;

    let anySkid = false;
    if (!wheelGrounded) {
      clearSkidTrail();
    } else {
      for (let i = 0; i < WHEEL_LOCAL.length; i += 1) {
        const inNormalSkid = skid.intensity > 0 && (skid.wheels === 'all' || i >= 2);
        const inOilSkid = wheelOnOil[i] === true && oilSkidActive > 0;
        const inOffroadSkid = wheelKinds[i] === 'offroad' && offroadSkidBoost > 0;
        const wheelIntensity = Math.max(
          inNormalSkid ? skid.intensity : 0,
          inOilSkid ? oilSkidActive : 0,
          inOffroadSkid ? offroadSkidBoost : 0,
        );

        if (wheelIntensity <= 0) {
          lastSkidPos.current[i] = null;
          continue;
        }

        anySkid = true;
        const offset = WHEEL_LOCAL[i]!;
        tmpOrigin.set(offset[0], offset[1], offset[2]).applyQuaternion(tmpQuat);
        const wx = tmpOrigin.x + translation.x;
        const wz = tmpOrigin.z + translation.z;
        const prevWheel = lastSkidPos.current[i];
        if (prevWheel) {
          pushSkidSample(prevWheel.x, prevWheel.z, wx, wz, wheelIntensity);
        }
        lastSkidPos.current[i] = { x: wx, z: wz };
      }

      // На дожде дым от старта с места (throttle-wheelspin) глушим: брызги рисует WheelSpray
      const throttleOnlySpin = skid.smoking && input.brake <= 0 && input.handbrake <= 0;
      const skidSmokeActive = skid.smoking && !(isRain && throttleOnlySpin);
      const smoking = skidSmokeActive || (oilSkidActive > SKID_SMOKE_THRESHOLD && wheelsOnOil > 0);
      if (!anySkid && offroadFx <= 0) {
        smokeTimer.current = 0;
        dirtSmokeTimer.current = 0;
      } else if (smoking) {
        smokeTimer.current += clampedDt;
        const peakIntensity = Math.max(skid.intensity, oilSkidActive);
        const smokeInterval = 0.09 - peakIntensity * 0.055;
        if (smokeTimer.current >= smokeInterval) {
          smokeTimer.current = 0;
          const wakeX = linvel.x + tmpRight.x * dampedLateral * 0.25;
          const wakeZ = linvel.z + tmpRight.z * dampedLateral * 0.25;
          for (let i = 0; i < WHEEL_LOCAL.length; i += 1) {
            const inNormalSkid = skidSmokeActive && (skid.wheels === 'all' || i >= 2);
            const inOilSmoke = wheelOnOil[i] === true && oilSkidActive > SKID_SMOKE_THRESHOLD;
            if (!inNormalSkid && !inOilSmoke) {
              continue;
            }
            const pos = lastSkidPos.current[i];
            if (pos) {
              const intensity = Math.max(
                inNormalSkid ? skid.intensity : 0,
                inOilSmoke ? oilSkidActive : 0,
              );
              pushSkidSmoke(pos.x, ROAD_TOP_Y + 0.06, pos.z, intensity, wakeX, 0, wakeZ);
            }
          }
        }
      } else {
        smokeTimer.current = 0;
      }

      if (offroadFx > 0.08) {
        dirtSmokeTimer.current += clampedDt;
        const dirtInterval = 0.11 - offroadFx * 0.05;
        if (dirtSmokeTimer.current >= dirtInterval) {
          dirtSmokeTimer.current = 0;
          const wakeX = linvel.x * 0.4;
          const wakeZ = linvel.z * 0.4;
          for (let i = 0; i < WHEEL_LOCAL.length; i += 1) {
            if (wheelKinds[i] !== 'offroad') {
              continue;
            }
            const pos = lastSkidPos.current[i] ?? prevZoneWheelPos.current[i];
            if (pos) {
              pushSkidSmoke(
                pos.x,
                ROAD_TOP_Y + 0.05,
                pos.z,
                0.25 + offroadFx * 0.45,
                wakeX,
                0.4,
                wakeZ,
              );
            }
          }
        }
      } else {
        dirtSmokeTimer.current = 0;
      }
    }

    // Опора под днищем (сетка по всей подошве капсулы): машина на стопке шин —
    // снап к дороге и кламп вертикали отключаются, иначе телепорт внутрь коллайдеров.
    // TOI ~ 0 = луч начался внутри препятствия (кузов уже в него утоплен) — тоже опора.
    for (const offset of OBSTACLE_PROBE_POINTS) {
      tmpOrigin.set(offset[0], offset[1], offset[2]).applyQuaternion(tmpQuat);
      const obstacleRay = new rapier.Ray(
        {
          x: tmpOrigin.x + translation.x,
          y: tmpOrigin.y + translation.y,
          z: tmpOrigin.z + translation.z,
        },
        { x: 0, y: -1, z: 0 },
      );
      const obstacle = world.castRayAndGetNormal(
        obstacleRay,
        WHEEL_GROUND_RAY,
        true,
        undefined,
        OBSTACLE_PROBE_GROUPS,
        undefined,
        body,
      );
      if (
        obstacle &&
        obstacle.timeOfImpact <= GROUND_PROBE_TOI &&
        (obstacle.timeOfImpact <= 0.06 || obstacle.normal.y >= GROUND_NORMAL_MIN_Y)
      ) {
        obstacleContact = true;
        break;
      }
    }

    tmpDesired
      .copy(tmpForward)
      .multiplyScalar(targetForward)
      .add(tmpRight.clone().multiplyScalar(dampedLateral));

    const desiredHz = Math.hypot(tmpDesired.x, tmpDesired.z);
    const slid = slideAlongWalls(world, rapier, body, tmpDesired);
    const slidHz = Math.hypot(slid.x, slid.z);
    // На земле не даем коллизиям подбрасывать машину вверх, но позволяем заезжать
    // на подъем: vy = желаемое скольжение по плоскости (зажато), только при реальном
    // контакте и вне трамплина. В grace/воздухе vy не трогаем — естественная дуга.
    const followVy = computeGroundFollowVy(
      tmpGroundNormal.x,
      tmpGroundNormal.y,
      tmpGroundNormal.z,
      slid.x,
      slid.z,
    );
    body.setLinvel(
      {
        x: slid.x,
        y:
          wheelGrounded && !rampContact && !obstacleContact
            ? Math.max(followVy, Math.min(linvel.y, 0))
            : linvel.y,
        z: slid.z,
      },
      true,
    );

    // Жесткая привязка к трассе: если решатель все же подбросил кузов над дорогой
    // (удар о бочку) — вернуть на высоту покоя и погасить вертикаль. На препятствии
    // (шина под колесом) не снаппим: иначе телепорт внутрь коллайдеров — тряска.
    if (wheelGrounded && roadYCount > 0 && !obstacleContact) {
      const restY = roadYSum / roadYCount;
      if (translation.y > restY + GROUND_SNAP_TOLERANCE) {
        body.setTranslation({ x: translation.x, y: restY, z: translation.z }, true);
        body.setLinvel({ x: slid.x, y: 0, z: slid.z }, true);
      }
    }

    // Анти-залипание: газ в пол, а машина стоит (шина упралась в стену/другие шины) —
    // непрерывно выталкивать препятствия из-под носового бампера, пока не поедет.
    stuckTimer.current = updateStuckTimer(
      isStuckAgainstObstacle({
        throttle: input.throttle,
        handbrake: input.handbrake,
        targetForward,
        forwardSpeed,
        grounded: wheelGrounded,
      }),
      clampedDt,
      stuckTimer.current,
    );
    if (isRescueActive(stuckTimer.current)) {
      const rescueBodies: RapierRigidBody[] = [];
      const seen = new Set<number>();
      world.intersectionsWithShape(
        {
          x: translation.x + tmpForward.x * RESCUE_NOSE_OFFSET,
          y: COLLIDER_Y,
          z: translation.z + tmpForward.z * RESCUE_NOSE_OFFSET,
        },
        { x: 0, y: 0, z: 0, w: 1 },
        new rapier.Ball(RESCUE_RADIUS),
        (collider) => {
          const obstacle = collider.parent();
          // шины и бочки — dynamic; статичный мир и самого себя пропускаем
          if (obstacle && obstacle.isDynamic() && !seen.has(obstacle.handle)) {
            seen.add(obstacle.handle);
            rescueBodies.push(obstacle);
          }
          return true;
        },
        undefined,
        TIRE_GROUPS,
        undefined,
        body,
      );
      for (const obstacle of rescueBodies) {
        const point = obstacle.translation();
        const impulse = computeRescueImpulse({
          carPosition: { x: translation.x, z: translation.z },
          carForward: { x: tmpForward.x, z: tmpForward.z },
          obstaclePosition: { x: point.x, z: point.z },
          obstacleMass: obstacle.mass(),
          carSpeed: targetForward,
          dt: clampedDt,
        });
        if (impulse) {
          obstacle.applyImpulse(impulse, true);
        }
      }
    }

    const steerStrength = computeSteerStrength(forwardSpeed, input.handbrake);
    const angvel = body.angvel();
    const steerSign = Math.sign(forwardSpeed || input.throttle - input.brake || 1);
    let nextYaw = integrateSteerYaw(angvel.y, input.steer, steerStrength, steerSign, clampedDt);
    nextYaw += computeOilYawKick(oilStrength, input.steer, forwardSpeed, lateral);
    // Кузов физически плоский: вращение и угловая скорость строго вокруг Y —
    // наклон корпуса только визуальный (по склону), крена в повороте нет.
    body.setAngvel({ x: 0, y: nextYaw, z: 0 }, true);

    // Визуальный attitude: наклон по нормали склона, без крена в повороте.
    const pitchTarget = wheelGrounded
      ? computeSlopePitchFromNormal(
          tmpGroundNormal.x,
          tmpGroundNormal.y,
          tmpGroundNormal.z,
          tmpForward.x,
          tmpForward.z,
        )
      : 0;
    applyVisualAttitude(pitchTarget, kerbShakePitch, clampedDt);

    tickDriveSfxSample({
      active: true,
      speedMs: speed,
      throttle: input.throttle,
      brake: input.brake,
      handbrake: input.handbrake,
      skidIntensity: Math.max(skid.intensity, oilSkidActive, offroadSkidBoost),
      oilStrength,
      wheelsOnOil,
      offRoadStrength: offroadFx,
      kerbRumble,
      wallScrape: mapWallScrape(desiredHz, slidHz),
      grounded: wheelGrounded,
    });
  });

  const dropSpawn: TVec3 = [
    spawnPosition[0],
    spawnPosition[1] + SPAWN_DROP_HEIGHT,
    spawnPosition[2],
  ];

  return (
    <>
      <RigidBody
        ref={bodyRef}
        name="vehicle"
        position={dropSpawn}
        rotation={[0, spawnRotationY, 0]}
        colliders={false}
        mass={88}
        linearDamping={0.16}
        angularDamping={1.0}
        enabledRotations={[false, true, false]}
        ccd
        canSleep={false}
        friction={0.1}
        restitution={0}
        collisionGroups={VEHICLE_GROUPS}
      >
        <CapsuleCollider
          args={[COLLIDER_HALF_HEIGHT, COLLIDER_RADIUS]}
          position={[0, COLLIDER_Y, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          friction={0.08}
          restitution={0}
          collisionGroups={VEHICLE_GROUPS}
        />
        <group ref={visualRef}>
          <VehicleModel
            vehicleId={vehicleId}
            carSkin={carSkin}
            headlightsOn={headlightsOn}
            driveVisualRef={driveVisualRef}
            headlightLampsRef={headlightLampsRef}
          />
        </group>
      </RigidBody>
      {headlightsOn ? (
        <VehicleHeadlights
          visualRef={visualRef}
          vehicleId={vehicleId}
          headlightLampsRef={headlightLampsRef}
        />
      ) : null}
    </>
  );
};

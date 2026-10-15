import { useEffect } from 'react';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import type { CollisionEnterPayload, RapierRigidBody } from '@react-three/rapier';
import type { TTrackObstacle, TVec3 } from '@/entities/track';
import { mapImpactFromSpeed, pulseDriveImpact } from '@/features/race-audio';
import {
  BARREL_MASS,
  clampBarrelVelocity,
  computeBarrelBounce,
} from '@/widgets/race-canvas/lib/barrel-impact';
import { pulseCameraShake } from '@/widgets/race-canvas/lib/camera-shake';
import { TIRE_GROUPS } from '@/widgets/race-canvas/lib/collision-groups';
import { isObstacleUnderCar } from '@/widgets/race-canvas/lib/obstacle-under-car';
import { registerTireHit } from '@/widgets/race-canvas/lib/tire-hit-damping';
import {
  isObstacleHitThrottled,
  resetObstacleHitThrottle,
} from '@/widgets/race-canvas/lib/tire-hit-throttle';

type TTrackObstaclesProps = {
  /** Список препятствий (стопки шин / бочки) */
  obstacles: TTrackObstacle[];
  /** Счётчик рестарта — сбрасывает позу препятствий */
  resetNonce: number;
};

/**
 * Грузовая трассовая покрышка (усредненная 315/80R22.5):
 * внешний диаметр ~1.2 м, сечение ~0.32 м, посадочное отверстие ~0.56 м (рим 22.5")
 */
const TIRE_RADIUS = 0.44;
const TIRE_TUBE = 0.16;
/** Узкая светлая полоса на внешнем борту (чуть крупнее основного тора) */
const TIRE_SIDEWALL_RADIUS = TIRE_RADIUS + 0.025;
const TIRE_SIDEWALL_TUBE = 0.06;
const TIRE_STACK_MASS = 12;
const TIRE_MASS = TIRE_STACK_MASS / 3;
const TIRE_TIER_COUNT = 3;
/** Шаг ярусов = ширина лежащей плашмя шины (2 × tube) с легким контактным сжатием */
const TIRE_TIER_SPACING = 0.35;
/** Центр нижней шины от центра стопки (stack height 1.05, нижняя шина лежит на земле) */
const TIRE_BASE_Y = 0.16 - 1.05 / 2;
/**
 * Коллайдер одной шины — цилиндр по внешнему габариту тора. Куб выступал углами за
 * видимый круг на ~25 см: машина цепляла невидимые углы и дрожала при задевании стопки.
 */
const TIRE_COLLIDER_RADIUS = TIRE_RADIUS + TIRE_TUBE;
const TIRE_COLLIDER_HALF_HEIGHT = 0.17;
/** Скорость машины ниже этого порога — не удар, а касание: только «сход» препятствия с бампера */
const HIT_MIN_SPEED = 0.5;
/** Номинальная скорость слабого касания для импульса схода шины, м/с */
const TIRE_TOUCH_IMPULSE_SPEED = 6;
const TIRE_HIT_FACTOR = 0.8;
const TIRE_IMPULSE_SCALE = 0.2;
const TIRE_TORQUE_SCALE = 0.08;
const TIRE_UP_IMPULSE_SCALE = 0.12;
const TIRE_LATERAL_SCATTER_SCALE = 0.18;

const TIRE_RUBBER = '#3e3e44';
const TIRE_SIDEWALL = '#6a6a72';
const BARREL_BODY = '#c45c12';
const BARREL_BAND = '#3a3a3c';
const BARREL_LID = '#2a2a2c';

const TIRE_TIER_OFFSETS = Array.from(
  { length: TIRE_TIER_COUNT },
  (_, tier) => TIRE_BASE_Y + tier * TIRE_TIER_SPACING,
);

/** Одна шина — mesh без физики */
const TireVisual = () => (
  <group rotation={[Math.PI / 2, 0, 0]}>
    <mesh castShadow receiveShadow>
      <torusGeometry args={[TIRE_RADIUS, TIRE_TUBE, 10, 18]} />
      <meshStandardMaterial color={TIRE_RUBBER} roughness={0.86} metalness={0} />
    </mesh>
    {/* Sidewall без cast — силуэт даёт основной тор, меньше work в shadow passes */}
    <mesh>
      <torusGeometry args={[TIRE_SIDEWALL_RADIUS, TIRE_SIDEWALL_TUBE, 8, 18]} />
      <meshStandardMaterial color={TIRE_SIDEWALL} roughness={0.88} metalness={0} />
    </mesh>
  </group>
);

/**
 * Визуал топливной бочки — стандартная евробочка: ⌀0.6 × 0.9 м,
 * обкатные обручи у верхнего и нижнего днищ
 */
const FuelBarrelVisual = () => (
  <group>
    <mesh castShadow receiveShadow position={[0, 0, 0]}>
      <cylinderGeometry args={[0.29, 0.29, 0.9, 16]} />
      <meshStandardMaterial color={BARREL_BODY} roughness={0.55} metalness={0.45} />
    </mesh>
    {/* Обручи и крышка без cast — корпус даёт читаемый силуэт */}
    <mesh position={[0, 0.27, 0]}>
      <cylinderGeometry args={[0.305, 0.305, 0.09, 16]} />
      <meshStandardMaterial color={BARREL_BAND} roughness={0.7} metalness={0.2} />
    </mesh>
    <mesh position={[0, -0.27, 0]}>
      <cylinderGeometry args={[0.305, 0.305, 0.09, 16]} />
      <meshStandardMaterial color={BARREL_BAND} roughness={0.7} metalness={0.2} />
    </mesh>
    <mesh position={[0, 0.44, 0]}>
      <cylinderGeometry args={[0.27, 0.27, 0.05, 16]} />
      <meshStandardMaterial color={BARREL_LID} roughness={0.4} metalness={0.55} />
    </mesh>
  </group>
);

type TObstacleHit = {
  /** Тело машины */
  vehicleBody: RapierRigidBody;
  /** Тело препятствия */
  obstacleBody: RapierRigidBody;
  /** Скорость машины в плоскости XZ, м/с (при касании — номинальная для импульса схода) */
  speed: number;
  /** Единичное направление движения машины */
  dirX: number;
  dirZ: number;
};

/**
 * Общая часть удара: звук, тряска и штраф скорости. На малой скорости — не null,
 * а «касание»: направление «машина -> препятствие», чтобы шина/бочка сходила с бампера
 * и не стопорила машину (импульс считается от minImpulseSpeed).
 * null — столкновение не с машиной или вырожденное направление.
 */
const beginObstacleHit = (
  payload: CollisionEnterPayload,
  minImpulseSpeed: number,
): TObstacleHit | null => {
  if (payload.other.rigidBodyObject?.name !== 'vehicle') {
    return null;
  }

  const vehicleBody = payload.other.rigidBody;
  const obstacleBody = payload.target.rigidBody;
  if (!vehicleBody || !obstacleBody) {
    return null;
  }

  const vel = vehicleBody.linvel();
  const speed = Math.hypot(vel.x, vel.z);
  // Повторный вход того же тела в churn-окне: только импульс схода, без штрафа/тряски
  if (!isObstacleHitThrottled(obstacleBody.handle, performance.now())) {
    registerTireHit(TIRE_HIT_FACTOR);
    const impact = mapImpactFromSpeed(speed);
    pulseDriveImpact(impact);
    pulseCameraShake(impact);
  }
  if (speed >= HIT_MIN_SPEED) {
    const invSpeed = 1 / speed;
    return { vehicleBody, obstacleBody, speed, dirX: vel.x * invSpeed, dirZ: vel.z * invSpeed };
  }

  const carPos = vehicleBody.translation();
  const obstaclePos = obstacleBody.translation();
  const dirX = obstaclePos.x - carPos.x;
  const dirZ = obstaclePos.z - carPos.z;
  const len = Math.hypot(dirX, dirZ);
  if (len < 1e-6) {
    return null;
  }
  return { vehicleBody, obstacleBody, speed: minImpulseSpeed, dirX: dirX / len, dirZ: dirZ / len };
};

/** Не даем машине взлететь от реакции столкновения */
const pinVehicleToGround = (vehicleBody: RapierRigidBody): void => {
  const vel = vehicleBody.linvel();
  if (vel.y > 0) {
    vehicleBody.setLinvel({ x: vel.x, y: 0, z: vel.z }, true);
  }
};

/** Удар по шине: разброс по ярусам, верхние подбрасываются сильнее */
const handleTireHit = (payload: CollisionEnterPayload, tier: number): void => {
  const hit = beginObstacleHit(payload, TIRE_TOUCH_IMPULSE_SPEED);
  if (!hit) {
    return;
  }

  const { obstacleBody, speed, dirX, dirZ } = hit;
  const impulse = TIRE_MASS * speed * TIRE_IMPULSE_SCALE;

  let impulseX = dirX * impulse;
  let impulseZ = dirZ * impulse;

  // Верхние шины подбрасываем сильнее; легкий боковой разброс по ярусу
  const tierNorm = tier / (TIRE_TIER_COUNT - 1);
  const impulseY = impulse * TIRE_UP_IMPULSE_SCALE * (0.35 + tierNorm);
  const side = tier % 2 === 0 ? 1 : -1;
  const scatter = impulse * TIRE_LATERAL_SCATTER_SCALE * (0.4 + tierNorm);
  impulseX += -dirZ * side * scatter;
  impulseZ += dirX * side * scatter;

  obstacleBody.applyImpulse({ x: impulseX, y: impulseY, z: impulseZ }, true);
  obstacleBody.applyTorqueImpulse(
    {
      x: -dirZ * impulse * TIRE_TORQUE_SCALE,
      y: (tier % 2 === 0 ? 1 : -1) * impulse * TIRE_TORQUE_SCALE * 0.5,
      z: dirX * impulse * TIRE_TORQUE_SCALE,
    },
    true,
  );

  // Шина под кузовом (машина перекатывается через стопку) — не пиним: решатель должен
  // вытолкнуть корпус наверх, иначе машина вжимается в шины и трясется/зависает.
  const carPos = hit.vehicleBody.translation();
  const q = hit.vehicleBody.rotation();
  // Форвард кузова = q * (0,0,1), проекция на XZ
  const fx = 2 * (q.x * q.z + q.w * q.y);
  const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  if (
    !isObstacleUnderCar({
      carPosition: carPos,
      carForward: { x: fx, z: fz },
      obstaclePosition: obstacleBody.translation(),
    })
  ) {
    pinVehicleToGround(hit.vehicleBody);
  }
};

/**
 * Удар по бочке: отскок считается явно (см. lib/barrel-impact). Боковая скорость
 * уводит бочку из-под бампера, плечо импульса дает кувырок, цилиндрический коллайдер —
 * качение. Без боковой составляющей бочка прилипает к бамперу: машина каждый кадр
 * получает целевую скорость, то есть для решателя она нематериальна.
 */
const handleBarrelHit = (payload: CollisionEnterPayload, sideBias: 1 | -1): void => {
  const hit = beginObstacleHit(payload, HIT_MIN_SPEED);
  if (!hit) {
    return;
  }

  const { obstacleBody, speed, dirX, dirZ } = hit;
  const bounce = computeBarrelBounce({
    carPosition: hit.vehicleBody.translation(),
    carVelocity: { x: dirX * speed, z: dirZ * speed },
    carSpeed: speed,
    barrelPosition: obstacleBody.translation(),
    sideBias,
  });

  obstacleBody.applyImpulseAtPoint(bounce.impulse, bounce.point, true);
  obstacleBody.applyTorqueImpulse(bounce.torqueImpulse, true);

  const clamped = clampBarrelVelocity(
    obstacleBody.linvel(),
    obstacleBody.angvel(),
    bounce.speedCap,
  );
  obstacleBody.setLinvel(clamped.linvel, true);
  obstacleBody.setAngvel(clamped.angvel, true);

  pinVehicleToGround(hit.vehicleBody);
};

type TTireStackProps = {
  /** Центр стопки в мире */
  position: TVec3;
  /** Поворот вокруг Y */
  rotationY: number;
  /** Индекс препятствия для ключей */
  stackIndex: number;
};

/** Три независимые шины — при ударе рассыпаются */
const TireStack = ({ position, rotationY, stackIndex }: TTireStackProps) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    {TIRE_TIER_OFFSETS.map((offsetY, tier) => (
      <RigidBody
        key={`tire-${stackIndex}-${tier}`}
        name={`obstacle-tire-${stackIndex}-${tier}`}
        type="dynamic"
        colliders={false}
        position={[0, offsetY, 0]}
        mass={TIRE_MASS}
        restitution={0}
        friction={0.85}
        linearDamping={0.55}
        angularDamping={0.45}
        canSleep
        ccd
        collisionGroups={TIRE_GROUPS}
        onCollisionEnter={(payload) => handleTireHit(payload, tier)}
      >
        <CylinderCollider
          args={[TIRE_COLLIDER_HALF_HEIGHT, TIRE_COLLIDER_RADIUS]}
          friction={0.85}
          restitution={0}
          collisionGroups={TIRE_GROUPS}
        />
        <TireVisual />
      </RigidBody>
    ))}
  </group>
);

/** Препятствия у стенок — dynamic, отлетают при ударе */
export const TrackObstacles = ({ obstacles, resetNonce }: TTrackObstaclesProps) => {
  // Рестарт пересоздаёт тела — окна троттлинга по старым handle не нужны
  useEffect(() => {
    resetObstacleHitThrottle();
  }, [resetNonce]);

  if (obstacles.length === 0) {
    return null;
  }

  return (
    <group key={`obstacles-${resetNonce}`}>
      {obstacles.map((obstacle, index) => {
        if (obstacle.kind === 'tireStack') {
          return (
            <TireStack
              key={`obstacle-tireStack-${index}`}
              position={obstacle.position}
              rotationY={obstacle.rotationY}
              stackIndex={index}
            />
          );
        }

        return (
          <RigidBody
            key={`obstacle-fuelBarrel-${index}`}
            name={`obstacle-${index}`}
            type="dynamic"
            colliders={false}
            position={obstacle.position}
            rotation={[0, obstacle.rotationY, 0]}
            restitution={0}
            friction={0.85}
            linearDamping={0.35}
            angularDamping={0.6}
            canSleep
            ccd
            collisionGroups={TIRE_GROUPS}
            onCollisionEnter={(payload) => handleBarrelHit(payload, index % 2 === 0 ? 1 : -1)}
          >
            {/* Масса на коллайдере: на RigidBody она не применяется, а инерция
                вращения считается из формы — иначе бочка почти невесома */}
            <CylinderCollider
              args={[obstacle.size[1] / 2, obstacle.size[0] / 2]}
              mass={BARREL_MASS}
              friction={0.85}
              restitution={0}
              collisionGroups={TIRE_GROUPS}
            />
            <FuelBarrelVisual />
          </RigidBody>
        );
      })}
    </group>
  );
};

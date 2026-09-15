import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { CollisionEnterPayload } from '@react-three/rapier';
import type { TTrackObstacle, TVec3 } from '@/entities/track';
import { TIRE_GROUPS } from '@/widgets/race-canvas/lib/collision-groups';
import { registerTireHit } from '@/widgets/race-canvas/lib/tire-hit-damping';

type TTrackObstaclesProps = {
  /** Список препятствий (стопки шин / бочки) */
  obstacles: TTrackObstacle[];
  /** Счётчик рестарта — сбрасывает позу препятствий */
  resetNonce: number;
};

const TIRE_RADIUS = 0.38;
const TIRE_TUBE = 0.14;
/** Узкая светлая полоса на внешнем борту (чуть крупнее основного тора) */
const TIRE_SIDEWALL_RADIUS = TIRE_RADIUS + 0.02;
const TIRE_SIDEWALL_TUBE = 0.05;
const TIRE_STACK_MASS = 12;
const TIRE_MASS = TIRE_STACK_MASS / 3;
const TIRE_TIER_COUNT = 3;
const TIRE_TIER_SPACING = 0.38;
const TIRE_BASE_Y = -0.4;
/** Половина габаритов коллайдера одной шины (аппроксимация тора) */
const TIRE_COLLIDER_HALF: TVec3 = [0.52, 0.14, 0.52];
const BARREL_MASS = 16;
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

/** Визуал топливной бочки */
const FuelBarrelVisual = () => (
  <group>
    <mesh castShadow receiveShadow position={[0, 0, 0]}>
      <cylinderGeometry args={[0.38, 0.4, 1.2, 14]} />
      <meshStandardMaterial color={BARREL_BODY} roughness={0.55} metalness={0.45} />
    </mesh>
    {/* Обручи и крышка без cast — корпус даёт читаемый силуэт */}
    <mesh position={[0, 0.12, 0]}>
      <cylinderGeometry args={[0.405, 0.405, 0.12, 14]} />
      <meshStandardMaterial color={BARREL_BAND} roughness={0.7} metalness={0.2} />
    </mesh>
    <mesh position={[0, -0.28, 0]}>
      <cylinderGeometry args={[0.405, 0.405, 0.1, 14]} />
      <meshStandardMaterial color={BARREL_BAND} roughness={0.7} metalness={0.2} />
    </mesh>
    <mesh position={[0, 0.58, 0]}>
      <cylinderGeometry args={[0.36, 0.36, 0.06, 14]} />
      <meshStandardMaterial color={BARREL_LID} roughness={0.4} metalness={0.55} />
    </mesh>
  </group>
);

type TObstacleHitOptions = {
  /** Масса тела, которому даём импульс */
  mass: number;
  /** Ярус шины 0..2 — задаёт разброс; для бочек не передаём */
  tier?: number;
};

/** Регистрирует удар машины о препятствие и даёт импульс */
const handleObstacleHit = (payload: CollisionEnterPayload, options: TObstacleHitOptions) => {
  const otherName = payload.other.rigidBodyObject?.name;
  if (otherName !== 'vehicle') {
    return;
  }

  const vehicleBody = payload.other.rigidBody;
  const obstacleBody = payload.target.rigidBody;
  if (!vehicleBody || !obstacleBody) {
    return;
  }

  registerTireHit(TIRE_HIT_FACTOR);

  const vel = vehicleBody.linvel();
  const speed = Math.hypot(vel.x, vel.z);
  if (speed < 0.5) {
    return;
  }

  const { mass, tier } = options;
  const invSpeed = 1 / speed;
  const dirX = vel.x * invSpeed;
  const dirZ = vel.z * invSpeed;
  const impulse = mass * speed * TIRE_IMPULSE_SCALE;

  let impulseX = dirX * impulse;
  let impulseY = 0;
  let impulseZ = dirZ * impulse;

  if (tier !== undefined) {
    // Верхние шины подбрасываем сильнее; лёгкий боковой разброс по ярусу
    const tierNorm = tier / (TIRE_TIER_COUNT - 1);
    impulseY = impulse * TIRE_UP_IMPULSE_SCALE * (0.35 + tierNorm);
    const side = tier % 2 === 0 ? 1 : -1;
    const scatter = impulse * TIRE_LATERAL_SCATTER_SCALE * (0.4 + tierNorm);
    impulseX += -dirZ * side * scatter;
    impulseZ += dirX * side * scatter;
  }

  obstacleBody.applyImpulse({ x: impulseX, y: impulseY, z: impulseZ }, true);
  obstacleBody.applyTorqueImpulse(
    {
      x: -dirZ * impulse * TIRE_TORQUE_SCALE,
      y: (tier !== undefined ? (tier % 2 === 0 ? 1 : -1) : 0) * impulse * TIRE_TORQUE_SCALE * 0.5,
      z: dirX * impulse * TIRE_TORQUE_SCALE,
    },
    true,
  );

  // Не даём машине взлететь от реакции столкновения
  const vehicleVel = vehicleBody.linvel();
  if (vehicleVel.y > 0) {
    vehicleBody.setLinvel({ x: vehicleVel.x, y: 0, z: vehicleVel.z }, true);
  }
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
        onCollisionEnter={(payload) => handleObstacleHit(payload, { mass: TIRE_MASS, tier })}
      >
        <CuboidCollider
          args={[TIRE_COLLIDER_HALF[0], TIRE_COLLIDER_HALF[1], TIRE_COLLIDER_HALF[2]]}
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
            mass={BARREL_MASS}
            restitution={0}
            friction={0.85}
            linearDamping={0.55}
            angularDamping={0.7}
            canSleep
            ccd
            collisionGroups={TIRE_GROUPS}
            onCollisionEnter={(payload) => handleObstacleHit(payload, { mass: BARREL_MASS })}
          >
            <CuboidCollider
              args={[obstacle.size[0] / 2, obstacle.size[1] / 2, obstacle.size[2] / 2]}
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

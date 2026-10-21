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
  isAudioUnlocked,
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
  computeGroundRestY,
  computeGroundStickY,
  computeSlopePitchFromNormal,
  computeSteerStrength,
  dampLateralVelocity,
  getDriveInput,
  getRaceHudSnapshot,
  GROUND_NORMAL_MIN_Y,
  integrateDriveForward,
  integrateSteerYaw,
  passedCheckpointZone,
  resolveGroundFollowVy,
  setVehiclePose,
  smoothAngleToward,
  smoothVyToward,
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

/** Headlight spotlights: intensity with headroom for decay=2 */
const HEADLIGHT_INTENSITY = 75;
const HEADLIGHT_ANGLE = 0.42;
const HEADLIGHT_PENUMBRA = 0.7;
const HEADLIGHT_DISTANCE = 24;
const HEADLIGHT_DECAY = 2;
/** Aim: at the asphalt plane ahead */
const HEADLIGHT_TARGET: TVec3 = [0, -1.0, 11];
/** One shadowed headlight × 768² instead of two — the main night shadow hotspot */
const HEADLIGHT_SHADOW_MAP = 768;
const HEADLIGHT_SHADOW_NEAR = 0.5;
const HEADLIGHT_SHADOW_BIAS = -0.00002;
const HEADLIGHT_SHADOW_NORMAL_BIAS = 0.015;
/** shadow camera fov ≈ 2 × spot angle (degrees) — no empty frustum */
const HEADLIGHT_SHADOW_FOV = (2 * HEADLIGHT_ANGLE * 180) / Math.PI;
/** scratch for decomposing the body's world matrix in the headlights */
const tmpHeadlightScale = new Vector3();

type TVehicleProps = {
  /** Spawn position on the track */
  spawnPosition: TVec3;
  /** Yaw angle at spawn (rad) */
  spawnRotationY: number;
  /** Race restart counter */
  resetNonce: number;
  /** Ref to the Rapier physics body */
  bodyRef: RefObject<RapierRigidBody | null>;
  /** Ref to the visual body group */
  visualRef: RefObject<Group | null>;
  /** Body chosen in the garage */
  vehicleId: TVehicleId;
  /** Body / cabin / wheel colors */
  carSkin: TCarSkin;
  /** Enable headlights (night) */
  headlightsOn: boolean;
  /** Oil slick zones on the track */
  oilSlicks: TOrientedBox[];
  /** Track centerline */
  centerline: TLoopPoint[];
  /** Road width */
  roadWidth: number;
  /** Road width per point (optional) */
  roadWidths?: number[];
  /** Rain: standing-start tire smoke is replaced by wheel spray */
  isRain: boolean;
};

type TVehicleHeadlightsProps = {
  /** Body visual group: rapier-interpolated pose + visual attitude */
  visualRef: RefObject<Group | null>;
  /** Body — fallback until the GLB reports measured lamps */
  vehicleId: TVehicleId;
  /** Positions from VehicleModel (Headlight meshes after fit) */
  headlightLampsRef: RefObject<THeadlightLamps | null>;
};

/** Configures the shadow map on the left headlight only */
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

/** Headlights live outside the RigidBody — otherwise the SpotLight shadow map doesn't occlude walls */
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

  /** Binds the aim-target; shadow on the left headlight only */
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

  // Binds the aim-target to the headlights after mounting.
  useLayoutEffect(() => {
    bindTargets();
  }, []);

  // Hard-locks the headlight group to the body pose: no smoothing,
  // so the light doesn't shift relative to the car under acceleration/braking.
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
 * Probe grid under the floor and ahead of the nose: the body capsule is much larger than a tire stack
 * (1.2×1.2), wheel rays fly past it — support under the body is searched across the whole footprint.
 * Points beyond the capsule front edge (z > 1.65) catch "nose-first into a stack":
 * a ray from inside the collider gives TOI ~ 0 and disables the road snap, otherwise the teleport
 * jams the body deeper into the tires — shaking and freezing.
 */
const OBSTACLE_PROBE_POINTS: TVec3[] = [-0.7, 0, 0.7].flatMap((px) =>
  [-1.5, -0.75, 0, 0.75, 1.5, 2.1, 2.6].map((pz) => [px, 0.05, pz] as TVec3),
);

const MAX_SPEED = VEHICLE_MAX_SPEED;
const REVERSE_MAX = VEHICLE_REVERSE_MAX;
/** Horizontal capsule ≈ body footprint: smooth sliding along walls */
const COLLIDER_HALF_X = 0.82;
const COLLIDER_HALF_Z = 1.65;
const COLLIDER_RADIUS = COLLIDER_HALF_X;
const COLLIDER_HALF_HEIGHT = COLLIDER_HALF_Z - COLLIDER_RADIUS;
const COLLIDER_Y = COLLIDER_RADIUS;
/** Ray margin beyond the collider edge for early slide */
const WALL_PROBE_MARGIN = 0.2;
/** Look-ahead (s): extends the probe by the velocity heading "into the wall", ~2–3 frames @ 60 fps */
const WALL_PROBE_LOOKAHEAD = 0.04;
/** Spawn height above the start point — the car drops onto the track */
const SPAWN_DROP_HEIGHT = 3.2;
/** After touchdown wait for near-zero vertical velocity */
const LAND_SETTLE_VY = 1.2;

/** Probe ray length under a wheel: reaches the ground with ~1.5 m headroom, but short enough not to catch distant walls */
const WHEEL_GROUND_RAY = 2.5;
/** Road contact threshold (m): to the ground ≈1.5–2.0 m, while TOI >2.5 m is a wall/embankment */
const GROUND_PROBE_TOI = 2.8;
/** "Grounded" grace after the last contact point — covers a brief liftoff at a crest */
const GROUNDED_GRACE_SECONDS = 0.15;
/** Altitude tolerance above the road: above it is a toss, return the body to the track */
const GROUND_SNAP_TOLERANCE = 0.25;

/** Raises the spawn point by SPAWN_DROP_HEIGHT above the asphalt */
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
// Wheel ray hit buffers (reused between frames)
const tmpWheelHitY: number[] = [0, 0, 0, 0];
const tmpWheelHitNX: number[] = [0, 0, 0, 0];
const tmpWheelHitNY: number[] = [0, 0, 0, 0];
const tmpWheelHitNZ: number[] = [0, 0, 0, 0];
/** Band of wheel hit heights around the topmost support; outside it a hit is not the road surface under the car (m) */
const DECK_HIT_SPREAD = 1.2;

/** Slides along a wall: removes the velocity component along the wall normal */
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
    // dir — ray toward the wall; extend the probe when moving into it
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
    // Wall normal (not a car axis) — otherwise at an angle the whole forward gets zeroed
    tmpNormal.set(hit.normal.x, 0, hit.normal.z);
    if (tmpNormal.lengthSq() < 0.001) {
      continue;
    }
    tmpNormal.normalize();
    // The normal must face the ray (from the wall toward the car)
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

/** Whether a wheel crossed any oriented-box zone, with subsampling between frames. */
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

/** Arcade car: responsive steering, sliding along walls */
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
  /** Locked x/z for the parked (countdown) pose */
  const parkedXZ = useRef<{ x: number; z: number } | null>(null);
  const groundedGrace = useRef(0);
  const lastGroundNormal = useRef({ x: 0, y: 1, z: 0 });
  /** Smoothed target vertical velocity for sliding along the surface */
  const followVyRef = useRef(0);
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

  // Visual body attitude: slope pitch + kerb shake. No roll in corners —
  // body lean in turns looked unrealistic. Written only to the child
  // visual group — the physics body stays flat (rotation around Y only).
  const applyVisualAttitude = (pitchTarget: number, kerbShakePitch: number, dt: number) => {
    visPitch.current = smoothAngleToward(visPitch.current, pitchTarget, dt);
    const visual = visualRef.current;
    if (visual) {
      visual.rotation.x = visPitch.current + kerbShakePitch;
    }
  };

  // Arcade physics: restart, input, grip and sliding along walls.
  useFrame((_, dt) => {
    const body = bodyRef.current;
    if (!body) {
      return;
    }

    if (lastNonce.current !== resetNonce) {
      lastNonce.current = resetNonce;
      awaitingLand.current = true;
      parkedXZ.current = null;
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
      followVyRef.current = 0;
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
    // Obstacle (tire stack) under the floor: road snap and vertical clamp are forbidden —
    // otherwise teleporting inside colliders = shaking/hanging. Detected by the grid below.
    let obstacleContact = false;
    tmpGroundNormal.set(0, 0, 0);
    // Wheel ray hits are collected first, then outliers are filtered: a ray from a wheel
    // past the edge of an elevated deck hits the ground below and, unfiltered, drags the
    // average height/normal down — the body stick pulls the car under the track.
    let deckTopY = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < WHEEL_LOCAL.length; i += 1) {
      const offset = WHEEL_LOCAL[i]!;
      tmpOrigin.set(offset[0], offset[1], offset[2]).applyQuaternion(tmpQuat);
      tmpOrigin.x += translation.x;
      tmpOrigin.y += translation.y;
      tmpOrigin.z += translation.z;
      const ray = new rapier.Ray(
        { x: tmpOrigin.x, y: tmpOrigin.y, z: tmpOrigin.z },
        { x: 0, y: -1, z: 0 },
      );
      // World only (road/walls): contact with a barrel/tire must not count as support
      // or disable the vertical velocity clamp — otherwise an obstacle tosses the car.
      const hit = world.castRayAndGetNormal(
        ray,
        WHEEL_GROUND_RAY,
        true,
        undefined,
        GROUND_PROBE_GROUPS,
        undefined,
        body,
      );
      tmpWheelHitY[i] = Number.POSITIVE_INFINITY;
      if (hit) {
        // Close hit on a nearly horizontal surface = real contact;
        // a far one — the car is airborne, a near-vertical normal is a wall, not ground.
        if (hit.timeOfImpact <= GROUND_PROBE_TOI && hit.normal.y >= GROUND_NORMAL_MIN_Y) {
          const hitY = tmpOrigin.y - hit.timeOfImpact;
          tmpWheelHitY[i] = hitY;
          tmpWheelHitNX[i] = hit.normal.x;
          tmpWheelHitNY[i] = hit.normal.y;
          tmpWheelHitNZ[i] = hit.normal.z;
          if (hitY > deckTopY) {
            deckTopY = hitY;
          }
        }
        // Ramp = a real slope (14–20°); a wall normal must not disable
        // the vertical velocity clamp, otherwise hitting a barrier tosses the car.
        if (hit.normal.y < 0.97 && hit.normal.y >= SLOPE_CONTACT_NORMAL_MIN_Y) {
          rampContact = true;
        }
      }
    }
    for (let i = 0; i < WHEEL_LOCAL.length; i += 1) {
      const y = tmpWheelHitY[i] ?? Number.POSITIVE_INFINITY;
      // outside the band around the topmost support — not the road surface under the car
      if (!Number.isFinite(y) || Math.abs(y - deckTopY) > DECK_HIT_SPREAD) {
        continue;
      }
      wheelGrounded = true;
      roadYSum += y;
      roadYCount += 1;
      if ((tmpWheelHitNY[i] ?? 0) >= SLOPE_CONTACT_NORMAL_MIN_Y) {
        tmpGroundNormal.x += tmpWheelHitNX[i] ?? 0;
        tmpGroundNormal.y += tmpWheelHitNY[i] ?? 0;
        tmpGroundNormal.z += tmpWheelHitNZ[i] ?? 0;
        groundNormalCount += 1;
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

    if (hud.status === 'ready') {
      // Hold the countdown until audio may play: music must start exactly on "3"
      if (
        awaitingLand.current &&
        wheelGrounded &&
        Math.abs(linvel.y) < LAND_SETTLE_VY &&
        isAudioUnlocked()
      ) {
        awaitingLand.current = false;
        // Drop lands with solver penetration and may bounce: snap to the rest height.
        if (roadYCount > 0) {
          const restY = computeGroundRestY(
            roadYSum / roadYCount,
            tmpGroundNormal.x,
            tmpGroundNormal.y,
            tmpGroundNormal.z,
            COLLIDER_HALF_Z,
          );
          body.setTranslation({ x: translation.x, y: restY, z: translation.z }, true);
          body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        }
        parkedXZ.current = { x: translation.x, z: translation.z };
        beginCountdown();
      }
      tickDriveSfxSample(IDLE_DRIVE_SFX_SAMPLE);
      return;
    }

    if (hud.status === 'countdown') {
      // Physics stays live during the countdown so the solver holds the true contact rest pose (pausing froze the body mid-settle, sunk under the asphalt).
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      if (parkedXZ.current) {
        body.setTranslation(
          {
            x: parkedXZ.current.x,
            y: translation.y,
            z: parkedXZ.current.z,
          },
          true,
        );
      }
      clearSkidTrail();
      driveVisualRef.current.kerbRumble = 0;
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
      // Airborne — the body eases back to level (pitch → 0).
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

    // Per-wheel surface / oil detection.
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
      // Shake pitch is added to the visual slope pitch in applyVisualAttitude.
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
    // Oil trail intensity for a wheel currently on a slick (not residual).
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

      // In rain, mute standing-start smoke (throttle-wheelspin): WheelSpray draws the splashes
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

    // Support under the floor (grid across the whole capsule footprint): car on a tire stack —
    // road snap and vertical clamp are disabled, otherwise teleport inside colliders.
    // TOI ~ 0 = the ray started inside the obstacle (the body is already sunk in) — also support.
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
    // On the ground collisions must not toss the car up, but driving onto a rise is allowed:
    // vy = desired slide along the plane (clamped), only on real contact and off a ramp.
    // In grace/air vy is untouched — natural arc.
    const followVy = computeGroundFollowVy(
      tmpGroundNormal.x,
      tmpGroundNormal.y,
      tmpGroundNormal.z,
      slid.x,
      slid.z,
    );
    // Positional stick to the equilibrium rest height: on a descent the solver damps
    // the normal component of vy and the body lags the receding deck, while near the crest
    // of a rise the tangential vy overshoots upward (convex profile) — in both cases the gap
    // grows to the threshold without correction and a jerky snap shakes the car.
    const slopeRestY =
      roadYCount > 0
        ? computeGroundRestY(
            roadYSum / roadYCount,
            tmpGroundNormal.x,
            tmpGroundNormal.y,
            tmpGroundNormal.z,
            COLLIDER_HALF_Z,
          )
        : 0;
    const stickY =
      wheelGrounded && !rampContact && !obstacleContact && roadYCount > 0
        ? computeGroundStickY(slopeRestY, translation.y)
        : null;
    if (stickY !== null) {
      body.setTranslation({ x: translation.x, y: stickY, z: translation.z }, true);
    }
    let nextVy = linvel.y;
    if (wheelGrounded && !rampContact && !obstacleContact) {
      const targetVy = resolveGroundFollowVy(followVy, linvel.y);
      // descent sticks positionally — vy unsmoothed; ascent/flat are smoothed
      nextVy = followVy < 0 ? targetVy : smoothVyToward(followVyRef.current, targetVy, clampedDt);
      followVyRef.current = nextVy;
    } else {
      followVyRef.current = linvel.y;
    }
    body.setLinvel({ x: slid.x, y: nextVy, z: slid.z }, true);

    // Hard track attachment: if the solver still tossed the body above the road
    // (barrel impact) — return to rest height and kill vertical motion. On an obstacle
    // (tire under a wheel) don't snap: otherwise teleport inside colliders — shaking.
    if (wheelGrounded && roadYCount > 0 && !obstacleContact) {
      const bodyY = stickY !== null ? stickY : translation.y;
      if (bodyY > slopeRestY + GROUND_SNAP_TOLERANCE) {
        body.setTranslation({ x: translation.x, y: slopeRestY, z: translation.z }, true);
        body.setLinvel({ x: slid.x, y: 0, z: slid.z }, true);
        followVyRef.current = 0;
      }
    }

    // Anti-stuck: throttle wide open but the car stands still (tire pressed into a wall/other tires) —
    // continuously push obstacles out from under the front bumper until it starts moving.
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
          // tires and barrels are dynamic; skip the static world and the car itself
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
    // The body is physically flat: rotation and angular velocity strictly around Y —
    // body pitch is visual only (along the slope), no roll in corners.
    body.setAngvel({ x: 0, y: nextYaw, z: 0 }, true);

    // Visual attitude: pitch along the slope normal, no roll in corners.
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

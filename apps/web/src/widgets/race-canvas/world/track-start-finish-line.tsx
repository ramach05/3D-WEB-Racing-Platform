import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  DoubleSide,
  Vector3,
  type Group,
  type MeshStandardMaterial,
  type Object3D,
  type SpotLight,
} from 'three';
import type { TOrientedBox, TTrackPalette } from '@/entities/track';
import { getRaceHudSnapshot } from '@/features/race-session';
import { scenePalette, startLightPalette } from '@/shared/config';
import {
  GANTRY_BEAM_CLEARANCE_Y,
  GANTRY_BEAM_DEPTH,
  GANTRY_BEAM_HEIGHT,
  GANTRY_FLOOD,
  GANTRY_FLOOD_PLACEMENTS,
  GANTRY_FLOOD_SPOT,
  GANTRY_PANEL_DEPTH,
  GANTRY_PANEL_HEIGHT,
  GANTRY_PANEL_WIDTH,
  GANTRY_POST_DEPTH,
  GANTRY_POST_OUTSET,
  GANTRY_POST_WIDTH,
  GANTRY_ROAD_TOP_Y,
  isFinishLampBlinkOn,
  isLampLit,
  litCountForHud,
  START_LAMP_BAY,
  START_LAMP_COUNT,
} from '@/widgets/race-canvas/lib/start-light-gantry';
import {
  getSharedStartLightHousingTexture,
  getSharedStartLightLensTextures,
} from '@/widgets/race-canvas/lib/start-light-textures';

type TTrackStartFinishLineProps = {
  /** Oriented box of the line */
  line: TOrientedBox;
  /** Road width for markings */
  roadWidth: number;
  /** Track palette (arrow / finish accent) */
  palette: TTrackPalette;
  /** Night stadium floodlights on the gantry */
  isNight: boolean;
};

type TGantryFloodLightProps = {
  /** Absolute post X (signed) */
  postX: number;
  /** Line side: +1 spawn, −1 finish pass */
  sideZ: 1 | -1;
  /** Beam center Y */
  beamY: number;
  /** Road width for aim */
  roadWidth: number;
  /** Whether the floodlight is on */
  isOn: boolean;
};

const CHECKER_COUNT = 10;
/** Arrow distances on the spawn side (+local Z / +lz); the car drives toward the line into −lz. */
const ARROW_DISTANCES = [2, 4, 6] as const;
const MARKING_Y = GANTRY_ROAD_TOP_Y + 0.002;

const LAMP_XS = Array.from({ length: START_LAMP_COUNT }, (_, i) => {
  const centered = i - (START_LAMP_COUNT - 1) / 2;
  return centered * START_LAMP_BAY.spacing;
});

/** Reused for housing.lookAt — do not allocate in layout-effect */
const floodAimWorld = new Vector3();

/** Stadium floodlight: Group.lookAt → +Z at the finish; lens and Spot on the front face. */
const GantryFloodLight = ({ postX, sideZ, beamY, roadWidth, isOn }: TGantryFloodLightProps) => {
  const spotRef = useRef<SpotLight>(null);
  const targetRef = useRef<Object3D>(null);
  const housingAimRef = useRef<Group>(null);

  const sideX = postX >= 0 ? 1 : -1;
  const mountY = beamY - GANTRY_FLOOD.mountDropY;
  const postInnerFaceX = -sideX * (GANTRY_POST_WIDTH / 2);
  const mountZ = sideZ * GANTRY_FLOOD.mountZOffset;
  const plateX = postInnerFaceX - sideX * (GANTRY_FLOOD.mountPlate.depth / 2);
  const armStartX = postInnerFaceX - sideX * GANTRY_FLOOD.mountPlate.depth;
  const armCenterX = armStartX - sideX * (GANTRY_FLOOD.arm.length / 2);
  const yokeX = armStartX - sideX * GANTRY_FLOOD.arm.length;

  /** Housing slightly past the yoke, above the road surface */
  const fixtureX = yokeX - sideX * 0.035;
  const fixtureY = -0.04;
  const fixtureZ = mountZ;

  /** Aim at the finish checker — center of its own half of the road */
  const aimLocalX = sideX * (roadWidth / 2) * GANTRY_FLOOD.aimXFraction - postX;
  const aimLocalY = GANTRY_ROAD_TOP_Y - mountY + 0.03;
  const aimLocalZ = GANTRY_FLOOD.aimZ;

  // Group.lookAt → +Z at the target; Spot target = the same point.
  useLayoutEffect(() => {
    const target = targetRef.current;
    const housing = housingAimRef.current;
    if (!target || !housing) {
      return;
    }
    target.updateMatrixWorld(true);
    target.getWorldPosition(floodAimWorld);
    housing.lookAt(floodAimWorld);

    if (!isOn) {
      return;
    }
    const spot = spotRef.current;
    if (!spot) {
      return;
    }
    spot.target = target;
    spot.target.updateMatrixWorld(true);
  }, [isOn, fixtureX, fixtureY, fixtureZ, aimLocalX, aimLocalY, aimLocalZ]);

  const lensY = GANTRY_FLOOD.lens.localY;
  const lensZ = GANTRY_FLOOD.lens.localZ;
  /** Housing slightly behind the lens front plane */
  const housingLocalZ = lensZ - GANTRY_FLOOD.housing.depth / 2 - 0.004;
  const boltSpread = GANTRY_FLOOD.mountPlate.width * 0.28;

  return (
    <group position={[postX, mountY, 0]}>
      <mesh position={[plateX, 0, mountZ]} castShadow>
        <boxGeometry
          args={[
            GANTRY_FLOOD.mountPlate.depth,
            GANTRY_FLOOD.mountPlate.height,
            GANTRY_FLOOD.mountPlate.width,
          ]}
        />
        <meshStandardMaterial color={startLightPalette.steel} metalness={0.4} roughness={0.55} />
      </mesh>

      {(
        [
          [boltSpread, boltSpread],
          [boltSpread, -boltSpread],
          [-boltSpread, boltSpread],
          [-boltSpread, -boltSpread],
        ] as const
      ).map(([bz, by]) => (
        <mesh
          key={`bolt-${bz}-${by}`}
          position={[plateX - sideX * (GANTRY_FLOOD.mountPlate.depth * 0.35), by, mountZ + bz]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.006, 0.006, 0.012, 8]} />
          <meshStandardMaterial color={startLightPalette.bezel} metalness={0.7} roughness={0.35} />
        </mesh>
      ))}

      <mesh position={[armCenterX, 0, mountZ]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry
          args={[GANTRY_FLOOD.arm.radius, GANTRY_FLOOD.arm.radius, GANTRY_FLOOD.arm.length, 10]}
        />
        <meshStandardMaterial color={startLightPalette.steel} metalness={0.45} roughness={0.5} />
      </mesh>

      <mesh position={[yokeX, 0, mountZ]} castShadow>
        <boxGeometry
          args={[GANTRY_FLOOD.yoke.depth, GANTRY_FLOOD.yoke.height, GANTRY_FLOOD.yoke.width]}
        />
        <meshStandardMaterial color={startLightPalette.bezel} metalness={0.55} roughness={0.42} />
      </mesh>

      {/* +Z at the finish; lens on the front face, housing behind */}
      <group ref={housingAimRef} position={[fixtureX, fixtureY, fixtureZ]}>
        <mesh position={[0, 0, housingLocalZ]} castShadow>
          <boxGeometry
            args={[
              GANTRY_FLOOD.housing.width,
              GANTRY_FLOOD.housing.height,
              GANTRY_FLOOD.housing.depth,
            ]}
          />
          <meshStandardMaterial
            color={startLightPalette.housing}
            metalness={0.35}
            roughness={0.55}
          />
        </mesh>
        <mesh
          position={[0, GANTRY_FLOOD.hood.offsetY, lensZ - GANTRY_FLOOD.hood.depth / 2]}
          castShadow
        >
          <boxGeometry
            args={[GANTRY_FLOOD.hood.width, GANTRY_FLOOD.hood.height, GANTRY_FLOOD.hood.depth]}
          />
          <meshStandardMaterial
            color={startLightPalette.housing}
            metalness={0.3}
            roughness={0.58}
          />
        </mesh>
        {/* XY disk faces +Z — only the front side glows */}
        <mesh position={[0, lensY, lensZ]}>
          <circleGeometry args={[GANTRY_FLOOD.lens.radius, 20]} />
          <meshStandardMaterial
            color={isOn ? startLightPalette.floodLight : startLightPalette.idle}
            emissive={isOn ? startLightPalette.floodLight : '#000000'}
            emissiveIntensity={isOn ? GANTRY_FLOOD.lensEmissiveIntensity : 0}
            metalness={0.08}
            roughness={0.22}
            toneMapped={false}
          />
        </mesh>

        {isOn ? (
          <spotLight
            ref={spotRef}
            position={[0, lensY, lensZ]}
            color={startLightPalette.floodLight}
            intensity={GANTRY_FLOOD_SPOT.intensity}
            distance={GANTRY_FLOOD_SPOT.distance}
            angle={GANTRY_FLOOD_SPOT.angle}
            penumbra={GANTRY_FLOOD_SPOT.penumbra}
            decay={GANTRY_FLOOD_SPOT.decay}
            castShadow={false}
          />
        ) : null}
      </group>

      <object3D ref={targetRef} position={[aimLocalX, aimLocalY, aimLocalZ]} />
    </group>
  );
};

/** Checker start/finish line, arrows and F1-gantry with start lights */
export const TrackStartFinishLine = ({
  line,
  roadWidth,
  palette,
  isNight,
}: TTrackStartFinishLineProps) => {
  const segmentWidth = roadWidth / CHECKER_COUNT;
  const postX = roadWidth / 2 + GANTRY_POST_OUTSET;
  const spanWidth = postX * 2 + GANTRY_POST_WIDTH;
  const postHeight = GANTRY_BEAM_CLEARANCE_Y + GANTRY_BEAM_HEIGHT / 2;
  const beamY = GANTRY_ROAD_TOP_Y + GANTRY_BEAM_CLEARANCE_Y;
  const panelY = beamY + GANTRY_BEAM_HEIGHT / 2 + GANTRY_PANEL_HEIGHT / 2 + 0.02;

  const leftPostMatRef = useRef<MeshStandardMaterial>(null);
  const rightPostMatRef = useRef<MeshStandardMaterial>(null);
  const beamMatRef = useRef<MeshStandardMaterial>(null);
  const panelMatRef = useRef<MeshStandardMaterial>(null);
  const lamp0MatRef = useRef<MeshStandardMaterial>(null);
  const lamp1MatRef = useRef<MeshStandardMaterial>(null);
  const lamp2MatRef = useRef<MeshStandardMaterial>(null);
  const lamp3MatRef = useRef<MeshStandardMaterial>(null);
  const lamp4MatRef = useRef<MeshStandardMaterial>(null);
  const pulseRef = useRef(0);

  // Updates start lamps and a slight structure pulse by HUD status.
  useFrame((_, dt) => {
    const hud = getRaceHudSnapshot();
    pulseRef.current += dt;
    const litCount = litCountForHud(hud.status, hud.countdownStep);
    const countdownPulse = 0.55 + Math.sin(pulseRef.current * 4) * 0.35;
    const finishBlinkOn = hud.status === 'finished' && isFinishLampBlinkOn(pulseRef.current);

    const lampMats = [
      lamp0MatRef.current,
      lamp1MatRef.current,
      lamp2MatRef.current,
      lamp3MatRef.current,
      lamp4MatRef.current,
    ];
    for (let i = 0; i < START_LAMP_COUNT; i += 1) {
      const mat = lampMats[i];
      if (!mat) {
        continue;
      }
      if (hud.status === 'finished') {
        if (finishBlinkOn) {
          mat.color.set('#ffffff');
          mat.emissive.set(startLightPalette.amber);
          mat.emissiveIntensity = START_LAMP_BAY.litEmissiveIntensity;
        } else {
          mat.color.set(startLightPalette.idle);
          mat.emissive.set(startLightPalette.idle);
          mat.emissiveIntensity = START_LAMP_BAY.idleEmissiveIntensity;
        }
        continue;
      }
      const on = isLampLit(i, litCount);
      if (on) {
        // White albedo + red emissive: the whole disk reads brightly in daylight
        mat.color.set('#ffffff');
        mat.emissive.set(startLightPalette.red);
        mat.emissiveIntensity = START_LAMP_BAY.litEmissiveIntensity * countdownPulse;
      } else {
        mat.color.set(startLightPalette.idle);
        mat.emissive.set(startLightPalette.idle);
        mat.emissiveIntensity = START_LAMP_BAY.idleEmissiveIntensity;
      }
    }

    const structurePulse = hud.status === 'countdown' ? 0.06 : 0.02;
    for (const mat of [
      leftPostMatRef.current,
      rightPostMatRef.current,
      beamMatRef.current,
      panelMatRef.current,
    ]) {
      if (!mat) {
        continue;
      }
      mat.emissive.set(startLightPalette.steelDark);
      mat.emissiveIntensity = structurePulse;
    }
  });

  const lampMatRefs = [lamp0MatRef, lamp1MatRef, lamp2MatRef, lamp3MatRef, lamp4MatRef] as const;

  // Shared without useMemo — after HMR the texture picks up the new singleton
  const housingMap = getSharedStartLightHousingTexture();
  const lensTextures = getSharedStartLightLensTextures();

  const panelZ = GANTRY_BEAM_DEPTH * 0.15;
  const lampFaceZ = panelZ + GANTRY_PANEL_DEPTH / 2 + START_LAMP_BAY.faceOutset;

  return (
    <group position={[line.position[0], 0, line.position[2]]} rotation={[0, line.rotationY, 0]}>
      {Array.from({ length: CHECKER_COUNT }, (_, index) => {
        const x = -roadWidth / 2 + segmentWidth / 2 + index * segmentWidth;
        const isWhite = index % 2 === 0;
        return (
          <mesh key={`checker-${index}`} position={[x, MARKING_Y, 0]} receiveShadow>
            <boxGeometry args={[segmentWidth, 0.004, 0.15]} />
            <meshStandardMaterial
              color={isWhite ? scenePalette.white : scenePalette.checkerDark}
              roughness={0.85}
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-1}
            />
          </mesh>
        );
      })}

      {/* F1 start-light gantry (visuals; colliders — TrackStartFinishColliders) */}
      <mesh position={[-postX, GANTRY_ROAD_TOP_Y + postHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[GANTRY_POST_WIDTH, postHeight, GANTRY_POST_DEPTH]} />
        <meshStandardMaterial
          ref={leftPostMatRef}
          color={startLightPalette.steel}
          emissive={startLightPalette.steelDark}
          emissiveIntensity={0.02}
          metalness={0.35}
          roughness={0.62}
        />
      </mesh>
      <mesh position={[postX, GANTRY_ROAD_TOP_Y + postHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[GANTRY_POST_WIDTH, postHeight, GANTRY_POST_DEPTH]} />
        <meshStandardMaterial
          ref={rightPostMatRef}
          color={startLightPalette.steel}
          emissive={startLightPalette.steelDark}
          emissiveIntensity={0.02}
          metalness={0.35}
          roughness={0.62}
        />
      </mesh>

      <mesh position={[0, beamY, 0]} castShadow receiveShadow>
        <boxGeometry args={[spanWidth, GANTRY_BEAM_HEIGHT, GANTRY_BEAM_DEPTH]} />
        <meshStandardMaterial
          ref={beamMatRef}
          color={startLightPalette.steel}
          emissive={startLightPalette.steelDark}
          emissiveIntensity={0.02}
          metalness={0.35}
          roughness={0.6}
        />
      </mesh>

      {/* Panel and lamps on +Z: spawn/approach from the +local Z side */}
      <mesh position={[0, panelY, panelZ]} castShadow>
        <boxGeometry args={[GANTRY_PANEL_WIDTH, GANTRY_PANEL_HEIGHT, GANTRY_PANEL_DEPTH]} />
        <meshStandardMaterial
          ref={panelMatRef}
          map={housingMap}
          color={startLightPalette.housing}
          emissive={startLightPalette.steelDark}
          emissiveIntensity={0.02}
          metalness={0.32}
          roughness={0.58}
        />
      </mesh>

      {LAMP_XS.map((x, index) => (
        <group key={`start-lamp-${index}`} position={[x, panelY, lampFaceZ]}>
          {/* Sun hood */}
          <mesh position={[0, START_LAMP_BAY.hood.offsetY, START_LAMP_BAY.hood.offsetZ]} castShadow>
            <boxGeometry
              args={[
                START_LAMP_BAY.hood.width,
                START_LAMP_BAY.hood.height,
                START_LAMP_BAY.hood.depth,
              ]}
            />
            <meshStandardMaterial
              color={startLightPalette.housing}
              metalness={0.3}
              roughness={0.58}
            />
          </mesh>

          {/* Dark recess in the housing */}
          <mesh
            position={[0, 0, -START_LAMP_BAY.recessDepth * 0.35]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry
              args={[
                START_LAMP_BAY.recessRadius,
                START_LAMP_BAY.recessRadius,
                START_LAMP_BAY.recessDepth,
                24,
              ]}
            />
            <meshStandardMaterial
              color={startLightPalette.steelDark}
              metalness={0.25}
              roughness={0.75}
            />
          </mesh>

          {/* Metal bezel ring */}
          <mesh position={[0, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry
              args={[
                START_LAMP_BAY.bezelOuterRadius,
                START_LAMP_BAY.bezelOuterRadius,
                START_LAMP_BAY.bezelDepth,
                28,
                1,
                true,
              ]}
            />
            <meshStandardMaterial
              color={startLightPalette.bezel}
              metalness={0.55}
              roughness={0.4}
              side={DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0, START_LAMP_BAY.bezelDepth * 0.5]}>
            <ringGeometry args={[START_LAMP_BAY.lensRadius, START_LAMP_BAY.bezelOuterRadius, 28]} />
            <meshStandardMaterial
              color={startLightPalette.bezel}
              metalness={0.55}
              roughness={0.38}
            />
          </mesh>

          {/* Flat LED lens */}
          <mesh position={[0, 0, 0.028]}>
            <circleGeometry args={[START_LAMP_BAY.lensRadius, 32]} />
            <meshStandardMaterial
              ref={lampMatRefs[index]}
              map={lensTextures.map}
              emissiveMap={lensTextures.emissiveMap}
              color={startLightPalette.idle}
              emissive={startLightPalette.idle}
              emissiveIntensity={START_LAMP_BAY.idleEmissiveIntensity}
              roughness={0.22}
              metalness={0.05}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {GANTRY_FLOOD_PLACEMENTS.map(({ sideX, sideZ }) => (
        <GantryFloodLight
          key={`gantry-flood-${sideX}-${sideZ}`}
          postX={sideX * postX}
          sideZ={sideZ}
          beamY={beamY}
          roadWidth={roadWidth}
          isOn={isNight}
        />
      ))}

      {ARROW_DISTANCES.map((distance) => (
        <group key={`arrow-${distance}`} position={[0, MARKING_Y, distance]}>
          {[-0.55, 0.55].map((xOffset) => (
            <mesh
              key={`chevron-${distance}-${xOffset}`}
              position={[xOffset, 0, 0]}
              rotation={[0, xOffset > 0 ? -Math.PI / 4 : Math.PI / 4, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[0.9, 0.004, 0.18]} />
              <meshStandardMaterial
                color={palette.accent}
                emissive={palette.accent}
                emissiveIntensity={0.7}
                roughness={0.45}
                polygonOffset
                polygonOffsetFactor={-1}
                polygonOffsetUnits={-1}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};

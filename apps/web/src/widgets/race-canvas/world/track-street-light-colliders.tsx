import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { placeStreetLamps, type TPlacedStreetLamp, type TTrackConfig } from '@/entities/track';
import { WORLD_GROUPS } from '@/widgets/race-canvas/lib/collision-groups';
import {
  STREET_LAMP_COLLIDER,
  STREET_LAMP_POLE_HEIGHT,
  STREET_LAMP_ROAD_TOP_Y,
} from '@/widgets/race-canvas/lib/street-lamp';

type TTrackStreetLightCollidersProps = {
  /** Track config — same lamp list as the visuals */
  config: TTrackConfig;
};

type TStreetLampColliderProps = {
  /** Placed street lamp */
  lamp: TPlacedStreetLamp;
  /** Index used in the key */
  index: number;
};

const FRICTION = 0.4;

/** Fixed body of one pole */
const StreetLampCollider = ({ lamp, index }: TStreetLampColliderProps) => {
  const centerY = STREET_LAMP_ROAD_TOP_Y + STREET_LAMP_POLE_HEIGHT / 2;

  return (
    <RigidBody
      name={`street-lamp-${index}`}
      type="fixed"
      colliders={false}
      position={[lamp.x, 0, lamp.z]}
      restitution={0}
      friction={FRICTION}
      collisionGroups={WORLD_GROUPS}
    >
      <CuboidCollider
        args={[
          STREET_LAMP_COLLIDER.halfWidth,
          STREET_LAMP_COLLIDER.halfHeight,
          STREET_LAMP_COLLIDER.halfDepth,
        ]}
        position={[0, centerY, 0]}
        friction={FRICTION}
        restitution={0}
        collisionGroups={WORLD_GROUPS}
      />
    </RigidBody>
  );
};

/** Fixed lamp-pole colliders inside Physics. Visuals stay in TrackStreetLights outside Physics. */
export const TrackStreetLightColliders = ({ config }: TTrackStreetLightCollidersProps) => {
  const lamps = useMemo(() => placeStreetLamps({ config }), [config]);

  if (lamps.length === 0) {
    return null;
  }

  return (
    <group>
      {lamps.map((lamp, index) => (
        <StreetLampCollider key={`street-lamp-collider-${index}`} lamp={lamp} index={index} />
      ))}
    </group>
  );
};

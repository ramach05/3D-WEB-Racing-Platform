import { interactionGroups } from '@react-three/rapier';

/** 0 = ground/walls, 1 = car, 2 = tires */
export const WORLD_GROUPS = interactionGroups(0, [0, 1, 2]);
export const VEHICLE_GROUPS = interactionGroups(1, [0, 2]);
export const TIRE_GROUPS = interactionGroups(2, [0, 1, 2]);
/** castRay wall-probe: world only, no tires */
export const WALL_PROBE_GROUPS = interactionGroups(1, [0]);
/** castRay ground-probe under the wheels: road/world only — obstacles don't launch the car */
export const GROUND_PROBE_GROUPS = interactionGroups(1, [0]);
/** castRay under the wheels against select obstacles: blocks snapping to the road when the car is on tires */
export const OBSTACLE_PROBE_GROUPS = interactionGroups(1, [2]);

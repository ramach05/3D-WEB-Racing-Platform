import { interactionGroups } from '@react-three/rapier';

/** 0 = пол/стены, 1 = машина, 2 = шины */
export const WORLD_GROUPS = interactionGroups(0, [0, 1, 2]);
export const VEHICLE_GROUPS = interactionGroups(1, [0, 2]);
export const TIRE_GROUPS = interactionGroups(2, [0, 1, 2]);
/** castRay wall-probe: только мир, без шин */
export const WALL_PROBE_GROUPS = interactionGroups(1, [0]);
/** castRay ground-probe под колесами: только дорога/мир — препятствия не подбрасывают машину */
export const GROUND_PROBE_GROUPS = interactionGroups(1, [0]);
/** castRay под колесами по одним препятствиям: блокирует снап к дороге, когда машина на шинах */
export const OBSTACLE_PROBE_GROUPS = interactionGroups(1, [2]);

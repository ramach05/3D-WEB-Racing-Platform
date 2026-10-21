export type TVehiclePose = {
  /** World X */
  x: number;
  /** World Z */
  z: number;
  /** Heading around Y, rad (0 = +Z) */
  yaw: number;
};

const pose: TVehiclePose = { x: 0, z: 0, yaw: 0 };

/** Writes the vehicle pose from useFrame without React events (tickRace pattern) */
export const setVehiclePose = (x: number, z: number, yaw: number): void => {
  pose.x = x;
  pose.z = z;
  pose.yaw = yaw;
};

/** Reads the latest vehicle pose (for the minimap, outside React renders) */
export const getVehiclePose = (): TVehiclePose => pose;

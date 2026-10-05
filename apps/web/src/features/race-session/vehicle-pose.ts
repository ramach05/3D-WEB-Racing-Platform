export type TVehiclePose = {
  /** Мировая X */
  x: number;
  /** Мировая Z */
  z: number;
  /** Курс вокруг Y, рад (0 = +Z) */
  yaw: number;
};

const pose: TVehiclePose = { x: 0, z: 0, yaw: 0 };

/** Пишет позу машины из useFrame без событий React (паттерн tickRace) */
export const setVehiclePose = (x: number, z: number, yaw: number): void => {
  pose.x = x;
  pose.z = z;
  pose.yaw = yaw;
};

/** Читает последнюю позу машины (для миникарты, вне React-рендера) */
export const getVehiclePose = (): TVehiclePose => pose;

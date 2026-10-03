export type TVehicleId = 'hatchback' | 'sedan' | 'pickup' | 'juke' | 'scirocco';

export type TVehicleBodyKind = 'gltf';

export type TVehicleDef = {
  id: TVehicleId;
  bodyKind: TVehicleBodyKind;
  gltfPath: string;
  /** Реальная длина кузова, м (паспортная) — из нее считается целевая длина fit */
  realLengthMeters?: number;
};

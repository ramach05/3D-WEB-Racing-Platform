export type TVehicleId = 'hatchback' | 'sedan' | 'pickup' | 'juke' | 'scirocco';

export type TVehicleBodyKind = 'gltf';

export type TVehicleDef = {
  id: TVehicleId;
  bodyKind: TVehicleBodyKind;
  gltfPath: string;
  /** Real body length in meters (spec sheet) — used to compute the fit target length */
  realLengthMeters?: number;
};

export type TVehicleId = 'hatchback' | 'sedan' | 'pickup' | 'juke' | 'scirocco';

export type TVehicleBodyKind = 'gltf';

export type TVehicleDef = {
  id: TVehicleId;
  bodyKind: TVehicleBodyKind;
  gltfPath: string;
};

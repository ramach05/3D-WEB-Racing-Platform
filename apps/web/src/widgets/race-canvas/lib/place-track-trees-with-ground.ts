import { placeTrackTrees, type TPlacedTree, type TTrackConfig } from '@/entities/track';
import {
  TRACK_TERRAIN,
  sampleTerrainHeight,
  terrainSeedForSlug,
} from '@/widgets/race-canvas/lib/terrain-height';

/** Tree placement with terrain height (groundY via sampleTerrainHeight). Single source of the list for visuals and colliders. */
export const placeTrackTreesWithGround = (config: TTrackConfig): TPlacedTree[] => {
  const seed = terrainSeedForSlug(config.slug);
  return placeTrackTrees({
    config,
    sampleGroundY: (x, z) =>
      sampleTerrainHeight(x, z, {
        centerline: config.centerline,
        roadWidth: config.roadWidth,
        seed,
      }) + TRACK_TERRAIN.yOffset,
  });
};

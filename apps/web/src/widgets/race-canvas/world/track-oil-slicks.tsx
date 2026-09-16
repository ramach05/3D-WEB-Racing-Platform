import { useEffect, useMemo } from 'react';
import { DoubleSide, MeshStandardMaterial, type CanvasTexture } from 'three';
import type { TOrientedBox, TTrackConfig } from '@/entities/track';
import { createOilSlickTexture } from '@/widgets/race-canvas/lib/oil-slick-texture';
import { ROAD_TOP_Y } from '@/widgets/race-canvas/lib/road-ribbon-geometry';

type TTrackOilSlicksProps = {
  /** Конфиг трассы с зонами масла */
  config: TTrackConfig;
};

type TOilSlickMeshProps = {
  /** Одна лужа */
  slick: TOrientedBox;
  /** Общий материал всех луж на трассе */
  material: MeshStandardMaterial;
};

/** Одна лужа: plane поверх асфальта, без castShadow */
const OilSlickMesh = ({ slick, material }: TOilSlickMeshProps) => {
  const width = slick.size[0];
  const length = slick.size[2];
  // Чуть выше дорожной разметки/следов, без z-fight со стенами
  const y = ROAD_TOP_Y + 0.004;

  return (
    <group position={[slick.position[0], y, slick.position[2]]} rotation={[0, slick.rotationY, 0]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        material={material}
        receiveShadow
        castShadow={false}
        renderOrder={2}
      >
        <planeGeometry args={[width, length]} />
      </mesh>
    </group>
  );
};

/**
 * Визуал луж масла вне Physics.
 * Одна shared texture + material на все пятна трассы.
 */
export const TrackOilSlicks = ({ config }: TTrackOilSlicksProps) => {
  const shared = useMemo(() => {
    const map: CanvasTexture = createOilSlickTexture(256);
    const material = new MeshStandardMaterial({
      map,
      transparent: true,
      depthWrite: false,
      metalness: 0.35,
      roughness: 0.22,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    return { map, material };
  }, []);

  useEffect(
    () => () => {
      shared.material.dispose();
      shared.map.dispose();
    },
    [shared],
  );

  if (config.oilSlicks.length === 0) {
    return null;
  }

  return (
    <group>
      {config.oilSlicks.map((slick, index) => (
        <OilSlickMesh
          key={`oil-${config.slug}-${index}-${slick.position[0].toFixed(2)}-${slick.position[2].toFixed(2)}`}
          slick={slick}
          material={shared.material}
        />
      ))}
    </group>
  );
};

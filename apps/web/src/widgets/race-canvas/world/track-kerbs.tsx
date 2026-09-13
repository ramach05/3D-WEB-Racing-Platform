import { useEffect, useMemo } from 'react';
import type { TTrackConfig } from '@/entities/track';
import { buildKerbRibbonGeometry } from '@/widgets/race-canvas/lib/kerb-ribbon-geometry';
import { createKerbTexture } from '@/widgets/race-canvas/lib/kerb-texture';

type TTrackKerbsProps = {
  /** Конфиг трассы */
  config: TTrackConfig;
};

type TKerbEdgeProps = {
  /** Centerline трассы */
  centerline: TTrackConfig['centerline'];
  /** Ширина дороги */
  roadWidth: number;
  /** +1 left / −1 right */
  sideSign: 1 | -1;
};

/** Один край поребрика */
const KerbEdge = ({ centerline, roadWidth, sideSign }: TKerbEdgeProps) => {
  const { geometry } = useMemo(
    () => buildKerbRibbonGeometry(centerline, roadWidth, sideSign),
    [centerline, roadWidth, sideSign],
  );
  const map = useMemo(() => createKerbTexture(), []);

  // Dispose geometry/texture on unmount
  useEffect(
    () => () => {
      geometry.dispose();
      map.dispose();
    },
    [geometry, map],
  );

  if (!geometry.getAttribute('position')) {
    return null;
  }

  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial
        map={map}
        roughness={0.78}
        metalness={0.02}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
};

/** Красно-белые поребрики по обоим краям асфальта */
export const TrackKerbs = ({ config }: TTrackKerbsProps) => (
  <group>
    <KerbEdge centerline={config.centerline} roadWidth={config.roadWidth} sideSign={1} />
    <KerbEdge centerline={config.centerline} roadWidth={config.roadWidth} sideSign={-1} />
  </group>
);

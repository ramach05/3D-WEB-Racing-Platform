import { useEffect, useRef } from 'react';
import type { TTrackConfig } from '@/entities/track';
import { getVehiclePose } from '@/features/race-session';
import { scenePalette } from '@/shared/config';
import { createMinimapProjection, TrackMinimap } from '@/widgets/track-minimap';

type TRaceMinimapProps = {
  /** Конфиг трассы для плана и проекции маркера */
  config: TTrackConfig;
  /** CSS-класс контейнера */
  className?: string;
};

/** Миникарта с живым маркером-стрелкой машины; transform пишется через rAF без ререндеров */
export const RaceMinimap = ({ config, className }: TRaceMinimapProps) => {
  const markerRef = useRef<SVGGElement>(null);

  // Поза машины обновляется в useFrame вне React, поэтому читаем её в rAF-цикле
  // и пишем transform прямо в DOM (тот же приём, что время/скорость в RaceHud).
  useEffect(() => {
    const projection = createMinimapProjection(config);

    const applyPose = (x: number, z: number, yaw: number): void => {
      const marker = markerRef.current;
      if (!marker) {
        return;
      }
      const point = projection.projectOnCenterline(x, z);
      const yawDeg = (yaw * 180) / Math.PI;
      marker.setAttribute(
        'transform',
        `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)}) rotate(${(-yawDeg).toFixed(1)})`,
      );
    };

    // Стартовый трансформ = проекция точки спавна, чтобы маркер не «прыгал»
    // из дефолтного значения на старт до первого rAF/физического кадра.
    applyPose(config.spawnPosition[0], config.spawnPosition[2], config.spawnRotationY);

    let raf = 0;
    const sync = () => {
      const pose = getVehiclePose();
      applyPose(pose.x, pose.z, pose.yaw);
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [config]);

  return (
    <div className={`sega-panel sega-panel--overlay p-1.5 ${className ?? ''}`}>
      <TrackMinimap config={config} className="block h-auto w-full opacity-90 lg:opacity-100">
        <g ref={markerRef} transform="translate(-20 -20)">
          {/* Якорь (0,0) = точка машины: translate ставит маркер ровно на centerline,
              rotate задает только направление. Симметричный относительно (0,0) треугольник
              не «уезжает» поперек дороги при повороте. */}
          <polygon
            points="0,12 -10,-10 10,-10"
            fill={config.palette.accent}
            stroke={scenePalette.white}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        </g>
      </TrackMinimap>
    </div>
  );
};

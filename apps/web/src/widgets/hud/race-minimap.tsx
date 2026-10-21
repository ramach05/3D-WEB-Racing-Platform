import { useEffect, useRef } from 'react';
import type { TTrackConfig } from '@/entities/track';
import { getVehiclePose } from '@/features/race-session';
import { scenePalette } from '@/shared/config';
import { createMinimapProjection, TrackMinimap } from '@/widgets/track-minimap';

type TRaceMinimapProps = {
  /** Track config for the plan view and marker projection */
  config: TTrackConfig;
  /** CSS class of the container */
  className?: string;
};

/** Minimap with a live vehicle chevron marker; transform is written via rAF without rerenders */
export const RaceMinimap = ({ config, className }: TRaceMinimapProps) => {
  const markerRef = useRef<SVGGElement>(null);

  // The vehicle pose updates in useFrame outside React, so read it in an rAF loop
  // and write transform straight into the DOM (same trick as time/speed in RaceHud).
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

    // Initial transform = projection of the spawn point so the marker does not "jump"
    // from its default value at the start before the first rAF/physics frame.
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
          {/* Anchor (0,0) = the car's point: translate places the marker exactly on the centerline,
              rotate sets only the direction. Shapes symmetric about (0,0)
              do not "slide" across the road when rotated. */}
          <circle
            className="sega-minimap-pulse"
            r={6}
            fill={config.palette.accent}
            opacity={0.35}
          />
          {/* Chevron "navigator": tip along the heading (+y), clipped tail */}
          <polygon
            points="0,10 -8,-8 0,-2.5 8,-8"
            fill={config.palette.accent}
            stroke={scenePalette.black}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <circle cy={4.5} r={1.4} fill={scenePalette.white} opacity={0.9} />
        </g>
      </TrackMinimap>
    </div>
  );
};

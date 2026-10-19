import type { ReactNode } from 'react';
import type { TTrackConfig } from '@/entities/track';
import { scenePalette } from '@/shared/config';
import {
  createMinimapProjection,
  MINIMAP_VIEW_HEIGHT,
  MINIMAP_VIEW_WIDTH,
} from './minimap-projection';

type TTrackMinimapProps = {
  /** Конфиг трассы для отрисовки плана */
  config: TTrackConfig;
  /** CSS-класс корневого SVG */
  className?: string;
  /** Дополнительная SVG-начинка поверх плана (например, маркер машины) */
  children?: ReactNode;
};

/** SVG-план трассы видом сверху */
export const TrackMinimap = ({ config, className, children }: TTrackMinimapProps) => {
  const points = config.centerline;
  if (points.length < 2) {
    return null;
  }

  const projection = createMinimapProjection(config);

  // Мировые XZ → координаты viewBox SVG
  const toSvg = (x: number, z: number): string => {
    const p = projection.project(x, z);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  };

  const centerPath = points.map((point) => toSvg(point.x, point.z)).join(' L ');
  const closedPath = `M ${centerPath} Z`;

  const wallOffset = config.roadWidth / 2 + 1.5;
  const outerPoints: string[] = [];
  const innerPoints: string[] = [];

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    if (!current || !next) {
      continue;
    }
    const dx = next.x - current.x;
    const dz = next.z - current.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    outerPoints.push(toSvg(current.x + nx * wallOffset, current.z + nz * wallOffset));
    innerPoints.push(toSvg(current.x - nx * wallOffset, current.z - nz * wallOffset));
  }

  const outerPath = `M ${outerPoints.join(' L ')} Z`;
  const innerPath = `M ${innerPoints.join(' L ')} Z`;

  const line = config.startFinishLine;
  const lineCenter = toSvg(line.position[0], line.position[2]).split(',');
  const forwardX = Math.sin(line.rotationY);
  const forwardZ = Math.cos(line.rotationY);
  const perpX = -forwardZ;
  const perpZ = forwardX;
  const lineHalfWidth = config.roadWidth / 2 + 2;
  const lineStart = toSvg(
    line.position[0] + perpX * lineHalfWidth,
    line.position[2] + perpZ * lineHalfWidth,
  ).split(',');
  const lineEnd = toSvg(
    line.position[0] - perpX * lineHalfWidth,
    line.position[2] - perpZ * lineHalfWidth,
  ).split(',');

  return (
    <svg
      viewBox={`0 0 ${MINIMAP_VIEW_WIDTH} ${MINIMAP_VIEW_HEIGHT}`}
      role="img"
      aria-hidden
      className={className}
      style={{ imageRendering: 'pixelated' }}
    >
      <rect
        width={MINIMAP_VIEW_WIDTH}
        height={MINIMAP_VIEW_HEIGHT}
        fill={config.palette.minimapBg}
      />
      <path d={outerPath} fill={config.palette.minimapWall} opacity={0.55} />
      <path d={innerPath} fill={config.palette.minimapBg} />
      <path
        d={closedPath}
        fill="none"
        stroke={config.palette.minimapRoad}
        strokeWidth={14}
        strokeLinejoin="miter"
      />
      <line
        x1={lineStart[0]}
        y1={lineStart[1]}
        x2={lineEnd[0]}
        y2={lineEnd[1]}
        stroke={scenePalette.white}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <polygon
        points={[
          toSvg(line.position[0] + forwardX * 5, line.position[2] + forwardZ * 5),
          toSvg(
            line.position[0] + forwardX * 2.5 + perpX * 1.2,
            line.position[2] + forwardZ * 2.5 + perpZ * 1.2,
          ),
          toSvg(
            line.position[0] + forwardX * 2.5 - perpX * 1.2,
            line.position[2] + forwardZ * 2.5 - perpZ * 1.2,
          ),
        ].join(' ')}
        fill={config.palette.accent}
        opacity={0.9}
      />
      <circle cx={lineCenter[0]} cy={lineCenter[1]} r={2.5} fill={scenePalette.white} />
      {children}
    </svg>
  );
};

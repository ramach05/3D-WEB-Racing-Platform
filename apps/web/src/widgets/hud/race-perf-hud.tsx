import type { CSSProperties } from 'react';
import { useRacePerf } from '@/features/race-perf';

/** Fixed slot for the number: labels do not shift as the digit count changes */
const slot = (widthCh: number): CSSProperties => ({
  display: 'inline-block',
  minWidth: `${widthCh}ch`,
  textAlign: 'right',
});

/** Text FPS overlay. Fixed panel and slot widths — data does not "jump". */
export const RacePerfHud = () => {
  const perf = useRacePerf();

  return (
    <div className="sega-race-hud sega-panel sega-panel--overlay w-auto px-4 py-3 text-sm text-[var(--sega-yellow)]">
      <p className="whitespace-nowrap">
        FPS: <span style={slot(3)}>{perf.fps}</span>
        {/* CPU/MEM do not fit in the narrow mobile overlay — from md up */}
        <span className="hidden md:inline">
          {' '}
          · CPU: <span style={slot(3)}>{perf.cpuPercent}</span>% · MEM:{' '}
          <span style={slot(4)}>{perf.memMb == null ? '—' : perf.memMb}</span>
          {perf.memMb == null ? '' : ' MB'}
        </span>
      </p>
    </div>
  );
};

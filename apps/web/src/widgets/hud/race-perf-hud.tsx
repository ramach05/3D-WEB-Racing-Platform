import type { CSSProperties } from 'react';
import { useRacePerf } from '@/features/race-perf';

/** Фикс. слот под число: метки не сдвигаются при смене количества цифр */
const slot = (widthCh: number): CSSProperties => ({
  display: 'inline-block',
  minWidth: `${widthCh}ch`,
  textAlign: 'right',
});

/** Текстовый FPS-оверлей. Фикс. ширина панели и слотов — данные не «прыгают». */
export const RacePerfHud = () => {
  const perf = useRacePerf();

  return (
    <div className="sega-race-hud sega-panel sega-panel--overlay w-auto px-4 py-3 text-sm text-[var(--sega-yellow)]">
      <p className="whitespace-nowrap">
        FPS: <span style={slot(3)}>{perf.fps}</span>
        {/* CPU/MEM не влезает в узкий мобильный оверлей — только с md */}
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

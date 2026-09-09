import { useRacePerf } from '@/features/race-perf';

/** Текстовый FPS-оверлей в левом верхнем углу (только dev) */
export const RacePerfHud = () => {
  const perf = useRacePerf();

  if (!import.meta.env.DEV) {
    return null;
  }

  const memLabel = perf.memMb == null ? '—' : `${perf.memMb} MB`;

  return (
    <div className="pointer-events-none absolute top-2 left-2 z-10 max-w-[calc(100%-1rem)] md:top-4 md:left-4">
      <div className="sega-panel !bg-black/75 px-3 py-2 text-xs text-[var(--sega-yellow)]">
        <p className="truncate">
          FPS: {perf.fps} · CPU: {perf.cpuPercent}% · MEM: {memLabel}
        </p>
      </div>
    </div>
  );
};

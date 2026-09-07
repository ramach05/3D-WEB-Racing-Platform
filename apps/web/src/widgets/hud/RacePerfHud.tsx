import { useRacePerf } from '@/features/race-perf';

/** Текстовый FPS-оверлей в левом верхнем углу (только dev) */
export const RacePerfHud = () => {
  const perf = useRacePerf();

  if (!import.meta.env.DEV) {
    return null;
  }

  const memLabel = perf.memMb == null ? '—' : `${perf.memMb} MB`;

  return (
    <div className="pointer-events-none absolute top-4 left-4 z-10">
      <div className="sega-panel !bg-black/75 px-3 py-2 text-xs text-[var(--sega-yellow)]">
        <p>
          FPS: {perf.fps} · CPU: {perf.cpuPercent}% · MEM: {memLabel}
        </p>
      </div>
    </div>
  );
};

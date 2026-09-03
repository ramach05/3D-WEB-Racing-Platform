import { useRacePerf } from '@/features/race-perf';

/** Текстовый FPS-оверлей в левом верхнем углу (только dev) */
export const RacePerfHud = () => {
  const perf = useRacePerf();

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute top-4 left-4 z-10">
      <div className="sega-panel !bg-black/75 px-3 py-2 text-xs text-[var(--sega-yellow)]">
        <p className="font-mono">
          FPS: {perf.fps} · {perf.ms} ms
        </p>
      </div>
    </div>
  );
};

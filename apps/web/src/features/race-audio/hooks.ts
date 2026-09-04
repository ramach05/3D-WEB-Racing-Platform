import { useEffect, useEffectEvent, useRef } from 'react';
import type { TrackAudioTheme } from '@/entities/track';
import { ChiptuneEngine } from './engine';

type UseRaceAudioOptions = {
  theme: TrackAudioTheme | null;
  paused: boolean;
  enabled: boolean;
  muted: boolean;
};

/** Запускает чиптюн на странице заезда */
export const useRaceAudio = ({ theme, paused, enabled, muted }: UseRaceAudioOptions): void => {
  const engineRef = useRef<ChiptuneEngine | null>(null);

  const applyTransport = useEffectEvent((engine: ChiptuneEngine) => {
    engine.setPaused(paused);
    engine.setMuted(muted);
  });

  useEffect(() => {
    if (!enabled || !theme) {
      return undefined;
    }
    const engine = new ChiptuneEngine();
    engineRef.current = engine;
    applyTransport(engine);
    void engine.start(theme);
    return () => {
      engine.stop();
      if (engineRef.current === engine) {
        engineRef.current = null;
      }
    };
  }, [enabled, theme]);

  useEffect(() => {
    const engine = engineRef.current;
    if (engine) {
      engine.setPaused(paused);
    }
  }, [paused]);

  useEffect(() => {
    const engine = engineRef.current;
    if (engine) {
      engine.setMuted(muted);
    }
  }, [muted]);
};

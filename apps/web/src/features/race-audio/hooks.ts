import { useEffect, useRef } from 'react';
import type { TrackAudioTheme } from '@/entities/track';
import { ChiptuneEngine } from './engine';

type UseRaceAudioOptions = {
  theme: TrackAudioTheme | null;
  paused: boolean;
  enabled: boolean;
};

/** Запускает чиптюн на странице заезда */
export const useRaceAudio = ({ theme, paused, enabled }: UseRaceAudioOptions): void => {
  const engineRef = useRef<ChiptuneEngine | null>(null);

  useEffect(() => {
    if (!enabled || !theme) {
      return undefined;
    }
    const engine = new ChiptuneEngine();
    engineRef.current = engine;
    void engine.start(theme);
    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, [enabled, theme]);

  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused]);
};

import { useEffect, useEffectEvent, useRef } from 'react';
import type { TTrackAudioTheme } from '@/entities/track';
import { ChiptuneEngine } from './engine';

type TUseRaceAudioOptions = {
  /** Тема чиптюна трассы */
  theme: TTrackAudioTheme | null;
  /** Пауза воспроизведения */
  paused: boolean;
  /** Включить аудио на странице */
  enabled: boolean;
  /** Полный mute */
  muted: boolean;
};

/** Запускает чиптюн на странице заезда */
export const useRaceAudio = ({ theme, paused, enabled, muted }: TUseRaceAudioOptions): void => {
  const engineRef = useRef<ChiptuneEngine | null>(null);

  /** Синхронизирует pause/mute с текущим движком */
  const applyTransport = useEffectEvent((engine: ChiptuneEngine) => {
    engine.setPaused(paused);
    engine.setMuted(muted);
  });

  // Создаёт движок при enable/theme и останавливает при cleanup.
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

  // Пробрасывает паузу в активный движок.
  useEffect(() => {
    const engine = engineRef.current;
    if (engine) {
      engine.setPaused(paused);
    }
  }, [paused]);

  // Пробрасывает mute в активный движок.
  useEffect(() => {
    const engine = engineRef.current;
    if (engine) {
      engine.setMuted(muted);
    }
  }, [muted]);
};

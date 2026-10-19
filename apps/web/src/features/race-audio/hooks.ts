import { useEffect, useEffectEvent, useRef } from 'react';
import {
  consumeDriveImpact,
  consumeDriveOilSlap,
  getDriveSfxSample,
  resetDriveSfx,
} from './drive-sfx-bus';
import { DrivingSfxEngine } from './driving-sfx-engine';
import { ChiptuneEngine, type TRaceMusicTheme } from './engine';

type TUseRaceAudioOptions = {
  /** Тема чиптюна: трасса или finish */
  theme: TRaceMusicTheme | null;
  /** Пауза воспроизведения */
  paused: boolean;
  /** Включить аудио на странице */
  enabled: boolean;
  /** Полный mute */
  muted: boolean;
};

type TUseRaceDrivingSfxOptions = {
  /** Включить SFX (обычно status === racing) */
  enabled: boolean;
  /** Пауза без destroy графа */
  paused: boolean;
  /** Общий mute с музыкой */
  muted: boolean;
};

/** Запускает чиптюн на странице заезда */
export const useRaceAudio = ({ theme, paused, enabled, muted }: TUseRaceAudioOptions): void => {
  const engineRef = useRef<ChiptuneEngine | null>(null);

  // Синхронизирует pause/mute с текущим движком
  const applyTransport = useEffectEvent((engine: ChiptuneEngine) => {
    engine.setPaused(paused);
    engine.setMuted(muted);
  });

  // Создает движок при enable/theme и останавливает при cleanup.
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

/** Запускает driving SFX и крутит rAF-обновление snapshot */
export const useRaceDrivingSfx = ({ enabled, paused, muted }: TUseRaceDrivingSfxOptions): void => {
  const engineRef = useRef<DrivingSfxEngine | null>(null);
  const rafRef = useRef<number | null>(null);

  // Синхронизирует pause/mute с текущим SFX-движком
  const applyTransport = useEffectEvent((engine: DrivingSfxEngine) => {
    engine.setPaused(paused);
    engine.setMuted(muted);
  });

  // Создает SFX-движок и rAF-цикл; на cleanup — stop + reset bus.
  useEffect(() => {
    if (!enabled) {
      resetDriveSfx();
      return undefined;
    }
    const engine = new DrivingSfxEngine();
    engineRef.current = engine;
    applyTransport(engine);
    void engine.start();

    const tick = () => {
      const impact = consumeDriveImpact();
      const oilSlap = consumeDriveOilSlap();
      engine.update(getDriveSfxSample(), impact, oilSlap);
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      engine.stop();
      if (engineRef.current === engine) {
        engineRef.current = null;
      }
      resetDriveSfx();
    };
  }, [enabled]);

  // Пробрасывает паузу в активный SFX-движок.
  useEffect(() => {
    const engine = engineRef.current;
    if (engine) {
      engine.setPaused(paused);
    }
  }, [paused]);

  // Пробрасывает mute в активный SFX-движок.
  useEffect(() => {
    const engine = engineRef.current;
    if (engine) {
      engine.setMuted(muted);
    }
  }, [muted]);
};

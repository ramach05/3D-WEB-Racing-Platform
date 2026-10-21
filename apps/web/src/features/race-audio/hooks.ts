import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { watchAudioGate } from './audio-gate';
import {
  consumeDriveImpact,
  consumeDriveOilSlap,
  getDriveSfxSample,
  resetDriveSfx,
} from './drive-sfx-bus';
import { DrivingSfxEngine } from './driving-sfx-engine';
import { ChiptuneEngine, type TRaceMusicTheme } from './engine';

type TUseRaceAudioOptions = {
  /** Chiptune theme: track or finish */
  theme: TRaceMusicTheme | null;
  /** Playback pause */
  paused: boolean;
  /** Enable audio on the page */
  enabled: boolean;
  /** Full mute */
  muted: boolean;
};

type TUseRaceDrivingSfxOptions = {
  /** Enable SFX (usually status === racing) */
  enabled: boolean;
  /** Pause without destroying the graph */
  paused: boolean;
  /** Shared mute with the music */
  muted: boolean;
};

/** true = the browser blocked autoplay and a user gesture is still needed to start audio */
export const useAudioAutoplayGate = (): boolean => {
  const [awaitingGesture, setAwaitingGesture] = useState(false);

  // Probes autoplay permission on mount; unlocks on the first gesture until cancel
  useEffect(() => watchAudioGate(setAwaitingGesture), []);

  return awaitingGesture;
};

/** Starts the chiptune on the race page */
export const useRaceAudio = ({ theme, paused, enabled, muted }: TUseRaceAudioOptions): void => {
  const engineRef = useRef<ChiptuneEngine | null>(null);

  // Syncs pause/mute with the current engine
  const applyTransport = useEffectEvent((engine: ChiptuneEngine) => {
    engine.setPaused(paused);
    engine.setMuted(muted);
  });

  // Creates the engine on enable/theme and stops it on cleanup.
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

  // Propagates pause to the active engine.
  useEffect(() => {
    const engine = engineRef.current;
    if (engine) {
      engine.setPaused(paused);
    }
  }, [paused]);

  // Propagates mute to the active engine.
  useEffect(() => {
    const engine = engineRef.current;
    if (engine) {
      engine.setMuted(muted);
    }
  }, [muted]);
};

/** Starts driving SFX and runs the rAF snapshot update loop */
export const useRaceDrivingSfx = ({ enabled, paused, muted }: TUseRaceDrivingSfxOptions): void => {
  const engineRef = useRef<DrivingSfxEngine | null>(null);
  const rafRef = useRef<number | null>(null);

  // Syncs pause/mute with the current SFX engine
  const applyTransport = useEffectEvent((engine: DrivingSfxEngine) => {
    engine.setPaused(paused);
    engine.setMuted(muted);
  });

  // Creates the SFX engine and rAF loop; on cleanup — stop + reset the bus.
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

  // Propagates pause to the active SFX engine.
  useEffect(() => {
    const engine = engineRef.current;
    if (engine) {
      engine.setPaused(paused);
    }
  }, [paused]);

  // Propagates mute to the active SFX engine.
  useEffect(() => {
    const engine = engineRef.current;
    if (engine) {
      engine.setMuted(muted);
    }
  }, [muted]);
};

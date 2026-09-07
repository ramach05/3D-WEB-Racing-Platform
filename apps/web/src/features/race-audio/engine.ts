import type { TTrackAudioTheme } from '@/entities/track';

type TNote = {
  freq: number;
  start: number;
  duration: number;
  type: OscillatorType;
};

const COASTAL_LOOP: TNote[] = [
  { freq: 196, start: 0, duration: 0.18, type: 'square' },
  { freq: 247, start: 0.2, duration: 0.18, type: 'square' },
  { freq: 294, start: 0.4, duration: 0.18, type: 'square' },
  { freq: 247, start: 0.6, duration: 0.18, type: 'square' },
  { freq: 196, start: 0.8, duration: 0.18, type: 'square' },
  { freq: 165, start: 1.0, duration: 0.35, type: 'triangle' },
  { freq: 220, start: 1.4, duration: 0.18, type: 'square' },
  { freq: 262, start: 1.6, duration: 0.18, type: 'square' },
  { freq: 330, start: 1.8, duration: 0.35, type: 'square' },
];

const NIGHT_LOOP: TNote[] = [
  { freq: 147, start: 0, duration: 0.22, type: 'sawtooth' },
  { freq: 175, start: 0.24, duration: 0.22, type: 'sawtooth' },
  { freq: 220, start: 0.48, duration: 0.22, type: 'sawtooth' },
  { freq: 175, start: 0.72, duration: 0.22, type: 'sawtooth' },
  { freq: 131, start: 0.96, duration: 0.44, type: 'triangle' },
  { freq: 165, start: 1.44, duration: 0.22, type: 'square' },
  { freq: 196, start: 1.68, duration: 0.22, type: 'square' },
  { freq: 262, start: 1.92, duration: 0.44, type: 'square' },
];

const LOOPS: Record<TTrackAudioTheme, { notes: TNote[]; loopSec: number }> = {
  coastal: { notes: COASTAL_LOOP, loopSec: 2.4 },
  night: { notes: NIGHT_LOOP, loopSec: 2.4 },
};

const MASTER_GAIN = 0.08;

/** Простой 8-битный движок на Web Audio (оригинальные петли, не OST игры) */
export class ChiptuneEngine {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private theme: TTrackAudioTheme | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private paused = false;
  private muted = false;
  private running = false;
  private generation = 0;
  private readonly activeOscillators = new Set<OscillatorNode>();

  private isAudible = (): boolean =>
    this.running && !this.paused && !this.muted && this.theme !== null;

  private applyGain = (): void => {
    if (this.gain) {
      this.gain.gain.value = this.isAudible() ? MASTER_GAIN : 0;
    }
  };

  private ensureContext = (): AudioContext | null => {
    if (!this.running) {
      return null;
    }
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gain = this.ctx.createGain();
      this.applyGain();
      this.gain.connect(this.ctx.destination);
    }
    return this.ctx;
  };

  private clearTimer = (): void => {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  };

  private stopAllNotes = (): void => {
    for (const osc of this.activeOscillators) {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
      try {
        osc.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.activeOscillators.clear();
  };

  private playNote = (note: TNote, when: number): void => {
    const ctx = this.ensureContext();
    if (!ctx || !this.gain) {
      return;
    }
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = note.type;
    osc.frequency.value = note.freq;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(0.35, when + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, when + note.duration);
    osc.connect(env);
    env.connect(this.gain);
    this.activeOscillators.add(osc);
    osc.onended = () => {
      this.activeOscillators.delete(osc);
      try {
        osc.disconnect();
      } catch {
        /* ignore */
      }
    };
    osc.start(when);
    osc.stop(when + note.duration + 0.02);
  };

  private scheduleLoop = (): void => {
    if (!this.isAudible() || !this.theme) {
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }
    const loop = LOOPS[this.theme];
    const now = ctx.currentTime;
    for (const note of loop.notes) {
      this.playNote(note, now + note.start);
    }
  };

  private startLoopTimer = (): void => {
    this.clearTimer();
    if (!this.theme || !this.running) {
      return;
    }
    const loop = LOOPS[this.theme];
    this.timer = setInterval(() => {
      this.scheduleLoop();
    }, loop.loopSec * 1000);
  };

  /** Запускает или останавливает воспроизведение в зависимости от paused/muted */
  private syncPlayback = (): void => {
    this.applyGain();
    if (this.isAudible()) {
      this.stopAllNotes();
      this.scheduleLoop();
      this.startLoopTimer();
      return;
    }
    this.stopAllNotes();
    this.clearTimer();
  };

  start = async (theme: TTrackAudioTheme): Promise<void> => {
    const generation = ++this.generation;
    this.running = true;
    this.theme = theme;
    this.clearTimer();
    this.stopAllNotes();

    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (generation !== this.generation || !this.running) {
      return;
    }
    this.syncPlayback();
  };

  setPaused = (paused: boolean): void => {
    if (this.paused === paused) {
      return;
    }
    this.paused = paused;
    this.syncPlayback();
  };

  setMuted = (muted: boolean): void => {
    if (this.muted === muted) {
      return;
    }
    this.muted = muted;
    this.syncPlayback();
  };

  stop = (): void => {
    this.generation += 1;
    this.running = false;
    this.clearTimer();
    this.stopAllNotes();
    this.theme = null;
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.gain = null;
    }
  };
}

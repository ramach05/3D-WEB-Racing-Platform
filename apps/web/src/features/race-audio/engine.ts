import type { TrackAudioTheme } from '@/entities/track';

type Note = {
  freq: number;
  start: number;
  duration: number;
  type: OscillatorType;
};

const COASTAL_LOOP: Note[] = [
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

const NIGHT_LOOP: Note[] = [
  { freq: 147, start: 0, duration: 0.22, type: 'sawtooth' },
  { freq: 175, start: 0.24, duration: 0.22, type: 'sawtooth' },
  { freq: 220, start: 0.48, duration: 0.22, type: 'sawtooth' },
  { freq: 175, start: 0.72, duration: 0.22, type: 'sawtooth' },
  { freq: 131, start: 0.96, duration: 0.44, type: 'triangle' },
  { freq: 165, start: 1.44, duration: 0.22, type: 'square' },
  { freq: 196, start: 1.68, duration: 0.22, type: 'square' },
  { freq: 262, start: 1.92, duration: 0.44, type: 'square' },
];

const LOOPS: Record<TrackAudioTheme, { notes: Note[]; loopSec: number }> = {
  coastal: { notes: COASTAL_LOOP, loopSec: 2.4 },
  night: { notes: NIGHT_LOOP, loopSec: 2.4 },
};

/** Простой 8-битный движок на Web Audio (оригинальные петли, не OST игры) */
export class ChiptuneEngine {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private theme: TrackAudioTheme | null = null;
  private startAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private paused = false;

  private ensureContext = (): AudioContext => {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0.08;
      this.gain.connect(this.ctx.destination);
    }
    return this.ctx;
  };

  private playNote = (note: Note, when: number): void => {
    const ctx = this.ensureContext();
    if (!this.gain) {
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
    osc.start(when);
    osc.stop(when + note.duration + 0.02);
  };

  private scheduleLoop = (): void => {
    const ctx = this.ensureContext();
    if (!this.theme) {
      return;
    }
    const loop = LOOPS[this.theme];
    const now = ctx.currentTime;
    for (const note of loop.notes) {
      this.playNote(note, now + note.start);
    }
  };

  start = async (theme: TrackAudioTheme): Promise<void> => {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    this.theme = theme;
    this.paused = false;
    this.scheduleLoop();
    const loop = LOOPS[theme];
    this.timer = setInterval(() => {
      if (!this.paused) {
        this.scheduleLoop();
      }
    }, loop.loopSec * 1000);
  };

  setPaused = (paused: boolean): void => {
    this.paused = paused;
    if (this.gain) {
      this.gain.gain.value = paused ? 0 : 0.08;
    }
  };

  stop = (): void => {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.gain = null;
    }
    this.theme = null;
  };
}

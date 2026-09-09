import type { TTrackAudioTheme } from '@/entities/track';

type TNote = {
  /** Частота, Гц (для tone) */
  freq: number;
  /** Старт относительно начала петли, с */
  start: number;
  /** Длительность ноты, с */
  duration: number;
  /** Форма осциллятора (для tone) */
  type: OscillatorType;
  /** Пик огибающей (по умолчанию 0.35) */
  gain?: number;
  /** Тон или шумовой удар */
  kind?: 'tone' | 'noise';
  /** Low-pass для noise (kick низкий, hat высокий) */
  filterFreq?: number;
};

const tone = (
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType,
  gain = 0.28,
): TNote => ({ kind: 'tone', freq, start, duration, type, gain });

const noise = (start: number, duration: number, gain: number, filterFreq: number): TNote => ({
  kind: 'noise',
  freq: 0,
  type: 'square',
  start,
  duration,
  gain,
  filterFreq,
});

/** Power chord: корень + квинта */
const power = (
  root: number,
  fifth: number,
  start: number,
  duration: number,
  type: OscillatorType,
  gain = 0.22,
): TNote[] => [
  tone(root, start, duration, type, gain),
  tone(fifth, start, duration, type, gain * 0.85),
];

// ---------------------------------------------------------------------------
// Coastal — яркий arena anthem (~160 BPM, мажор C, gallop + высокий square)
// доля 0.375 с, петля 4.5 с (12 долей)
// C3=131 G3=196 | G2=98 D3=147 | F2=87 C3=131 | Bb2=117 F3=175
// ---------------------------------------------------------------------------
const C_BEAT = 0.375;
const C_E = C_BEAT / 2;
const C_LOOP = 4.5;

/** Gallop: ♪♪♩ на доле (две шестнадцатых + восьмая) */
const gallop = (
  root: number,
  fifth: number,
  from: number,
  beats: number,
  type: OscillatorType,
  gain = 0.2,
): TNote[] => {
  const notes: TNote[] = [];
  const sixteenth = C_BEAT / 4;
  for (let b = 0; b < beats; b += 1) {
    const t = from + b * C_BEAT;
    notes.push(...power(root, fifth, t, sixteenth * 0.9, type, gain));
    notes.push(...power(root, fifth, t + sixteenth, sixteenth * 0.9, type, gain * 0.9));
    notes.push(...power(root, fifth, t + sixteenth * 2, C_E * 0.9, type, gain));
  }
  return notes;
};

const COASTAL_DRUMS: TNote[] = (() => {
  const hits: TNote[] = [];
  for (let beat = 0; beat < 12; beat += 1) {
    const t = beat * C_BEAT;
    if (beat % 2 === 0) {
      hits.push(noise(t, 0.06, 0.36, 160));
    }
    if (beat % 2 === 1) {
      hits.push(noise(t, 0.08, 0.34, 3800));
    }
    // открытый hat на «и»
    hits.push(noise(t + C_E, 0.03, 0.12, 10000));
    // crash-ish на начало каждого 4-такта
    if (beat % 4 === 0) {
      hits.push(noise(t, 0.12, 0.18, 6000));
    }
  }
  return hits;
})();

const COASTAL_BASS: TNote[] = [
  ...gallop(131, 196, 0, 4, 'square', 0.18),
  ...gallop(98, 147, 4 * C_BEAT, 4, 'square', 0.19),
  ...gallop(87, 131, 8 * C_BEAT, 2, 'square', 0.2),
  ...gallop(117, 175, 10 * C_BEAT, 2, 'square', 0.22),
];

/** Гимновый lead: скачки октав, длинные ноты, яркий square */
const COASTAL_LEAD: TNote[] = [
  tone(523, 0, C_BEAT * 1.5, 'square', 0.36),
  tone(659, 0.5625, C_E * 0.95, 'square', 0.34),
  tone(784, 0.75, C_BEAT * 1.4, 'square', 0.38),
  tone(659, 1.3125, C_E * 0.9, 'square', 0.32),
  tone(587, 1.5, C_BEAT, 'sawtooth', 0.34),
  tone(523, 1.875, C_E * 0.9, 'square', 0.3),
  tone(494, 2.0625, C_E * 0.9, 'square', 0.3),
  tone(523, 2.25, C_BEAT * 1.2, 'square', 0.36),
  tone(392, 2.8125, C_E * 0.95, 'sawtooth', 0.32),
  tone(440, 3.0, C_E * 0.95, 'square', 0.34),
  tone(494, 3.1875, C_E * 0.95, 'square', 0.34),
  tone(523, 3.375, C_BEAT * 1.1, 'square', 0.38),
  tone(698, 3.9375, C_BEAT * 0.95, 'sawtooth', 0.36),
  tone(784, 4.3125, C_E * 0.95, 'square', 0.4),
];

const COASTAL_LOOP: TNote[] = [...COASTAL_BASS, ...COASTAL_LEAD, ...COASTAL_DRUMS];

// ---------------------------------------------------------------------------
// Night — тяжёлый blues swagger (~120 BPM, A-минор, shuffle + call/response)
// доля 0.5 с, петля 6.4 с (≈12.8 долей / 3.2 такта с паузами)
// A2=110 E3=165 | G2=98 D3=147 | E2=82 B2=123 | D2=73 A2=110
// ---------------------------------------------------------------------------
const N_BEAT = 0.5;
const N_SWING = N_BEAT * (2 / 3); // длинная доля shuffle
const N_SHORT = N_BEAT / 3;
const N_LOOP = 6.4;

/** Shuffle-бас: длинная + короткая вместо ровных восьмых */
const shuffleBass = (
  root: number,
  fifth: number,
  from: number,
  beats: number,
  type: OscillatorType,
  gain = 0.24,
): TNote[] => {
  const notes: TNote[] = [];
  for (let b = 0; b < beats; b += 1) {
    const t = from + b * N_BEAT;
    notes.push(...power(root, fifth, t, N_SWING * 0.85, type, gain));
    notes.push(...power(root, fifth, t + N_SWING, N_SHORT * 0.8, type, gain * 0.85));
  }
  return notes;
};

const NIGHT_DRUMS: TNote[] = (() => {
  const hits: TNote[] = [];
  // 12 долей: kick на 1 и «и» перед 3, snare на 2 и 4, редкий hat
  for (let beat = 0; beat < 12; beat += 1) {
    const t = beat * N_BEAT;
    const inBar = beat % 4;
    if (inBar === 0) {
      hits.push(noise(t, 0.09, 0.42, 140));
    }
    if (inBar === 2) {
      hits.push(noise(t, 0.08, 0.36, 150));
      hits.push(noise(t - N_SHORT, 0.05, 0.28, 130)); // push kick
    }
    if (inBar === 1 || inBar === 3) {
      hits.push(noise(t, 0.1, 0.3, 2800));
    }
    // только четвертные hat — суше, чем у coastal
    hits.push(noise(t + N_SWING, 0.02, 0.08, 7500));
  }
  return hits;
})();

const NIGHT_BASS: TNote[] = [
  ...shuffleBass(110, 165, 0, 4, 'triangle', 0.26),
  ...shuffleBass(98, 147, 4 * N_BEAT, 2, 'triangle', 0.24),
  ...shuffleBass(82, 123, 6 * N_BEAT, 2, 'square', 0.22),
  ...shuffleBass(110, 165, 8 * N_BEAT, 2, 'triangle', 0.26),
  ...shuffleBass(73, 110, 10 * N_BEAT, 2, 'square', 0.28),
];

/**
 * Call-and-response blues lead (паузы между фразами).
 * A-минорная пентатоника: A C D E G
 */
const NIGHT_LEAD: TNote[] = [
  // call
  tone(220, 0.15, N_SHORT * 1.2, 'sawtooth', 0.38),
  tone(262, 0.15 + N_SHORT * 1.3, N_SHORT, 'sawtooth', 0.34),
  tone(294, 0.15 + N_SHORT * 2.4, N_BEAT * 0.9, 'sawtooth', 0.4),
  // response (ниже, с блюзовой «синей» нотой ~G#)
  tone(196, 2.15, N_SHORT * 1.1, 'sawtooth', 0.36),
  tone(208, 2.15 + N_SHORT * 1.2, N_SHORT, 'square', 0.32),
  tone(220, 2.15 + N_SHORT * 2.3, N_BEAT, 'sawtooth', 0.38),
  // второй call — выше
  tone(330, 4.2, N_SHORT, 'sawtooth', 0.4),
  tone(294, 4.2 + N_SHORT * 1.1, N_SHORT, 'sawtooth', 0.36),
  tone(262, 4.2 + N_SHORT * 2.2, N_SHORT, 'square', 0.34),
  tone(220, 4.2 + N_SHORT * 3.3, N_BEAT * 1.1, 'sawtooth', 0.42),
  // финальный punch
  tone(165, 5.7, N_BEAT * 0.7, 'square', 0.36),
  tone(220, 6.05, N_BEAT * 0.55, 'sawtooth', 0.4),
];

const NIGHT_LOOP: TNote[] = [...NIGHT_BASS, ...NIGHT_LEAD, ...NIGHT_DRUMS];

const LOOPS: Record<TTrackAudioTheme, { notes: TNote[]; loopSec: number }> = {
  coastal: { notes: COASTAL_LOOP, loopSec: C_LOOP },
  night: { notes: NIGHT_LOOP, loopSec: N_LOOP },
};

const MASTER_GAIN = 0.1;
const DEFAULT_NOTE_GAIN = 0.35;

/** Оригинальный chip-rock на Web Audio (в духе Rock n' Roll Racing / SEGA Genesis, не OST) */
export class ChiptuneEngine {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private theme: TTrackAudioTheme | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private paused = true;
  private muted = false;
  private running = false;
  private generation = 0;
  private readonly activeSources = new Set<AudioScheduledSourceNode>();

  /** Можно ли сейчас звучать */
  private isAudible = (): boolean =>
    this.running && !this.paused && !this.muted && this.theme !== null;

  /** Выставляет master gain по audible */
  private applyGain = (): void => {
    if (this.gain) {
      this.gain.gain.value = this.isAudible() ? MASTER_GAIN : 0;
    }
  };

  /** Лениво создаёт AudioContext и GainNode */
  private ensureContext = (): AudioContext | null => {
    if (!this.running) {
      return null;
    }
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gain = this.ctx.createGain();
      this.applyGain();
      this.gain.connect(this.ctx.destination);
      this.noiseBuffer = null;
    }
    return this.ctx;
  };

  /** Короткий буфер белого шума для ударных */
  private getNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const length = Math.floor(ctx.sampleRate * 0.2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  };

  /** Сбрасывает интервал петли */
  private clearTimer = (): void => {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  };

  /** Останавливает все активные источники */
  private stopAllNotes = (): void => {
    for (const src of this.activeSources) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      try {
        src.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.activeSources.clear();
  };

  /** Регистрирует источник и чистит его после окончания */
  private trackSource = (src: AudioScheduledSourceNode): void => {
    this.activeSources.add(src);
    src.onended = () => {
      this.activeSources.delete(src);
      try {
        src.disconnect();
      } catch {
        /* ignore */
      }
    };
  };

  /** Планирует тоновую ноту */
  private playTone = (note: TNote, when: number): void => {
    const ctx = this.ensureContext();
    if (!ctx || !this.gain) {
      return;
    }
    const peak = note.gain ?? DEFAULT_NOTE_GAIN;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = note.type;
    osc.frequency.value = note.freq;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(peak, when + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(note.duration, 0.02));
    osc.connect(env);
    env.connect(this.gain);
    this.trackSource(osc);
    osc.start(when);
    osc.stop(when + note.duration + 0.02);
  };

  /** Планирует шумовой удар (kick / snare / hat) */
  private playNoise = (note: TNote, when: number): void => {
    const ctx = this.ensureContext();
    if (!ctx || !this.gain) {
      return;
    }
    const peak = note.gain ?? DEFAULT_NOTE_GAIN;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = note.filterFreq ?? 2000;
    filter.Q.value = 0.7;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(peak, when + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(note.duration, 0.015));
    src.connect(filter);
    filter.connect(env);
    env.connect(this.gain);
    this.trackSource(src);
    src.start(when);
    src.stop(when + note.duration + 0.02);
  };

  /** Планирует одну ноту или удар */
  private playNote = (note: TNote, when: number): void => {
    if (note.kind === 'noise') {
      this.playNoise(note, when);
      return;
    }
    this.playTone(note, when);
  };

  /** Ставит в очередь одну итерацию петли темы */
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

  /** Запускает интервал повтора петли */
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

  /** Стартует тему (resume AudioContext при необходимости) */
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

  /** Пауза/снятие паузы без смены темы */
  setPaused = (paused: boolean): void => {
    if (this.paused === paused) {
      return;
    }
    this.paused = paused;
    this.syncPlayback();
  };

  /** Mute/unmute без смены темы */
  setMuted = (muted: boolean): void => {
    if (this.muted === muted) {
      return;
    }
    this.muted = muted;
    this.syncPlayback();
  };

  /** Полная остановка и закрытие AudioContext */
  stop = (): void => {
    this.generation += 1;
    this.running = false;
    this.clearTimer();
    this.stopAllNotes();
    this.theme = null;
    this.noiseBuffer = null;
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.gain = null;
    }
  };
}

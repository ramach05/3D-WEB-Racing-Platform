import type { TTrackAudioTheme } from '@/entities/track';

/** Тема BGM заезда: луп трассы или финишный victory */
export type TRaceMusicTheme = TTrackAudioTheme | 'finish';

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
// Coastal — быстрая Rock 'n' Roll вариация мотива Storm (~150 BPM, мажор G)
// доля 0.4 с, петля 4.8 с (12 долей)
// G2=98 D3=147 | C3=131 G3=196 | D3=147 A3=220
// ---------------------------------------------------------------------------
const C_BEAT = 0.4;
const C_EIGHTH = C_BEAT / 2;
const C_LOOP = 4.8;

const COASTAL_DRUMS: TNote[] = (() => {
  const hits: TNote[] = [];
  for (let beat = 0; beat < 12; beat += 1) {
    const t = beat * C_BEAT;
    // kick on 1,3 snare on 2,4
    if (beat % 2 === 0) {
      hits.push(noise(t, 0.06, 0.42, 140));
    } else {
      hits.push(noise(t, 0.055, 0.36, 190));
    }
    // closed hat on 8ths
    hits.push(noise(t + C_EIGHTH, 0.022, 0.16, 7000));
    // open hat on 4
    if (beat % 4 === 3) {
      hits.push(noise(t, 0.07, 0.13, 9000));
    }
    // crash-ish на начало петли
    if (beat === 0) {
      hits.push(noise(t, 0.1, 0.15, 6000));
    }
  }
  return hits;
})();

const COASTAL_BASS: TNote[] = [
  ...power(98, 147, 0, C_BEAT * 1.8, 'square', 0.22),
  ...power(98, 147, C_BEAT * 2, C_BEAT * 1.8, 'square', 0.22),
  ...power(131, 196, C_BEAT * 4, C_BEAT * 1.8, 'square', 0.22),
  ...power(131, 196, C_BEAT * 6, C_BEAT * 1.8, 'square', 0.22),
  ...power(147, 220, C_BEAT * 8, C_BEAT * 1.8, 'square', 0.22),
  ...power(147, 220, C_BEAT * 10, C_BEAT * 1.8, 'square', 0.22),
  // верхний дрон-слой G через всю петлю (как треугольный слой в Storm)
  ...power(196, 294, 0, C_BEAT * 1.8, 'triangle', 0.18),
  ...power(196, 294, C_BEAT * 2, C_BEAT * 1.8, 'triangle', 0.18),
  ...power(196, 294, C_BEAT * 4, C_BEAT * 1.8, 'triangle', 0.18),
  ...power(196, 294, C_BEAT * 6, C_BEAT * 1.8, 'triangle', 0.18),
  ...power(196, 294, C_BEAT * 8, C_BEAT * 1.8, 'triangle', 0.18),
  ...power(196, 294, C_BEAT * 10, C_BEAT * 1.8, 'triangle', 0.18),
];

/** Риф — структура Storm (нисходящий проход → длинная нота → bridge → square-fill), тональность G */
const COASTAL_RIFF: TNote[] = [
  // phrase 1: нисходящий прогон (D E G E D C B C)
  tone(294, 0.08, C_EIGHTH * 0.8, 'sawtooth', 0.32),
  tone(330, 0.08 + C_EIGHTH, C_EIGHTH * 0.8, 'sawtooth', 0.3),
  tone(392, 0.08 + C_EIGHTH * 2, C_EIGHTH * 0.8, 'sawtooth', 0.34),
  tone(330, 0.08 + C_EIGHTH * 3, C_EIGHTH * 0.8, 'sawtooth', 0.3),
  tone(294, 0.08 + C_EIGHTH * 4, C_EIGHTH * 0.8, 'sawtooth', 0.32),
  tone(262, 0.08 + C_EIGHTH * 5, C_EIGHTH * 0.8, 'sawtooth', 0.3),
  tone(247, 0.08 + C_EIGHTH * 6, C_EIGHTH * 0.8, 'sawtooth', 0.28),
  tone(262, 0.08 + C_EIGHTH * 7, C_EIGHTH * 0.8, 'sawtooth', 0.3),
  // phrase 2: выше, с длинной A
  tone(294, C_BEAT * 2.08, C_EIGHTH * 0.8, 'sawtooth', 0.32),
  tone(330, C_BEAT * 2.08 + C_EIGHTH, C_EIGHTH * 0.8, 'sawtooth', 0.3),
  tone(440, C_BEAT * 2.08 + C_EIGHTH * 2, C_BEAT * 0.9, 'sawtooth', 0.36),
  tone(392, C_BEAT * 2.08 + C_EIGHTH * 3, C_EIGHTH * 0.8, 'sawtooth', 0.32),
  tone(330, C_BEAT * 2.08 + C_EIGHTH * 4, C_EIGHTH * 0.8, 'sawtooth', 0.3),
  tone(294, C_BEAT * 2.08 + C_EIGHTH * 5, C_EIGHTH * 0.8, 'sawtooth', 0.28),
  tone(262, C_BEAT * 2.08 + C_EIGHTH * 6, C_BEAT * 0.7, 'sawtooth', 0.3),
  tone(294, C_BEAT * 2.08 + C_EIGHTH * 7, C_EIGHTH * 0.8, 'sawtooth', 0.32),
  // bridge: спуск B C D E D C B A под C-аккорд
  tone(247, C_BEAT * 4.08, C_EIGHTH * 0.8, 'sawtooth', 0.32),
  tone(262, C_BEAT * 4.08 + C_EIGHTH, C_EIGHTH * 0.8, 'sawtooth', 0.3),
  tone(294, C_BEAT * 4.08 + C_EIGHTH * 2, C_EIGHTH * 0.8, 'sawtooth', 0.34),
  tone(330, C_BEAT * 4.08 + C_EIGHTH * 3, C_EIGHTH * 0.8, 'sawtooth', 0.32),
  tone(294, C_BEAT * 4.08 + C_EIGHTH * 4, C_EIGHTH * 0.8, 'sawtooth', 0.3),
  tone(262, C_BEAT * 4.08 + C_EIGHTH * 5, C_EIGHTH * 0.8, 'sawtooth', 0.28),
  tone(247, C_BEAT * 4.08 + C_EIGHTH * 6, C_EIGHTH * 0.8, 'sawtooth', 0.3),
  tone(220, C_BEAT * 4.08 + C_EIGHTH * 7, C_EIGHTH * 0.8, 'sawtooth', 0.32),
  // fill: восходящий square-забег в D
  tone(294, C_BEAT * 6.08, C_EIGHTH * 0.5, 'square', 0.36),
  tone(330, C_BEAT * 6.08 + C_EIGHTH, C_EIGHTH * 0.5, 'square', 0.36),
  tone(392, C_BEAT * 6.08 + C_EIGHTH * 2, C_EIGHTH * 0.5, 'square', 0.36),
  tone(440, C_BEAT * 6.08 + C_EIGHTH * 3, C_EIGHTH * 0.5, 'square', 0.36),
  tone(494, C_BEAT * 6.08 + C_EIGHTH * 4, C_EIGHTH * 0.5, 'square', 0.36),
  tone(523, C_BEAT * 6.08 + C_EIGHTH * 5, C_EIGHTH * 0.5, 'square', 0.36),
  tone(587, C_BEAT * 6.08 + C_EIGHTH * 6, C_BEAT * 0.6, 'sawtooth', 0.42),
];

const COASTAL_LOOP: TNote[] = [...COASTAL_BASS, ...COASTAL_RIFF, ...COASTAL_DRUMS];

// ---------------------------------------------------------------------------
// Night — тяжёлая Rock 'n' Roll вариация мотива Storm (~124 BPM, минор E)
// доля 0.484 с, петля 5.81 с (12 долей)
// E2=82 B2=123 | C2=65 G2=98 | A2=110 E3=165 | B2=123 F#3=185
// ---------------------------------------------------------------------------
const N_BEAT = 0.484;
const N_EIGHTH = N_BEAT / 2;
const N_LOOP = 5.81;

/** Boogie-бас восьмыми: корень—квинта—корень—октава */
const boogie8 = (
  root: number,
  fifth: number,
  octave: number,
  from: number,
  beats: number,
  gain = 0.24,
): TNote[] => {
  const notes: TNote[] = [];
  for (let i = 0; i < beats * 2; i += 1) {
    const freq = [root, fifth, root, octave][i % 4] ?? root;
    notes.push(
      tone(freq, from + i * N_EIGHTH, N_EIGHTH * 0.8, 'square', i % 2 === 0 ? gain : gain * 0.85),
    );
  }
  return notes;
};

const NIGHT_DRUMS: TNote[] = (() => {
  const hits: TNote[] = [];
  for (let beat = 0; beat < 12; beat += 1) {
    const t = beat * N_BEAT;
    // kick on 1,3 snare on 2,4
    if (beat % 2 === 0) {
      hits.push(noise(t, 0.08, 0.46, 120));
    } else {
      hits.push(noise(t, 0.07, 0.4, 170));
    }
    // closed hat on 8ths
    hits.push(noise(t + N_EIGHTH, 0.025, 0.14, 5500));
    // open hat on 4
    if (beat % 4 === 3) {
      hits.push(noise(t, 0.08, 0.13, 7500));
    }
    // tom-подъезд к началу петли
    if (beat === 11) {
      hits.push(noise(t + N_EIGHTH, 0.06, 0.3, 320));
    }
  }
  return hits;
})();

const NIGHT_BASS: TNote[] = [
  ...boogie8(82, 123, 165, 0, 4, 0.26),
  ...boogie8(65, 98, 131, N_BEAT * 4, 4, 0.24),
  ...boogie8(110, 165, 220, N_BEAT * 8, 2, 0.25),
  ...boogie8(123, 185, 247, N_BEAT * 10, 2, 0.26),
];

/** Хук-мелодия E-минор: восходящий вопрос-ответ в высоком регистре, кодa октавой вниз */
const NIGHT_RIFF: TNote[] = [
  // такт 1 (Em): хук — двойной удар E, подъём к длинной B
  tone(330, 0.05, N_EIGHTH * 0.8, 'sawtooth', 0.4),
  tone(330, 0.05 + N_EIGHTH, N_EIGHTH * 0.7, 'square', 0.3),
  tone(392, 0.05 + N_BEAT, N_EIGHTH * 0.8, 'sawtooth', 0.4),
  tone(440, 0.05 + N_BEAT * 1.5, N_EIGHTH * 0.8, 'sawtooth', 0.4),
  tone(494, 0.05 + N_BEAT * 2, N_BEAT * 1.2, 'sawtooth', 0.44),
  tone(440, 0.05 + N_BEAT * 3.2, N_EIGHTH * 0.8, 'sawtooth', 0.36),
  tone(392, 0.05 + N_BEAT * 3.6, N_EIGHTH * 0.8, 'sawtooth', 0.36),
  // такт 2 (C): тот же хук на ступень выше, вершина C5
  tone(392, 0.05 + N_BEAT * 4, N_EIGHTH * 0.8, 'sawtooth', 0.4),
  tone(392, 0.05 + N_BEAT * 4.5, N_EIGHTH * 0.7, 'square', 0.3),
  tone(440, 0.05 + N_BEAT * 5, N_EIGHTH * 0.8, 'sawtooth', 0.4),
  tone(494, 0.05 + N_BEAT * 5.5, N_EIGHTH * 0.8, 'sawtooth', 0.4),
  tone(523, 0.05 + N_BEAT * 6, N_BEAT * 1.2, 'sawtooth', 0.44),
  tone(494, 0.05 + N_BEAT * 7.2, N_EIGHTH * 0.8, 'sawtooth', 0.36),
  tone(440, 0.05 + N_BEAT * 7.6, N_EIGHTH * 0.8, 'sawtooth', 0.36),
  // такт 3 (A–B): пик A/C5, затем E5-кульминация с кодой октавой вниз
  tone(440, 0.05 + N_BEAT * 8, N_EIGHTH * 0.8, 'sawtooth', 0.42),
  tone(440, 0.05 + N_BEAT * 8.5, N_EIGHTH * 0.7, 'square', 0.32),
  tone(523, 0.05 + N_BEAT * 9, N_EIGHTH * 0.8, 'sawtooth', 0.42),
  tone(440, 0.05 + N_BEAT * 9.5, N_EIGHTH * 0.8, 'sawtooth', 0.38),
  tone(494, 0.05 + N_BEAT * 10, N_EIGHTH * 0.8, 'sawtooth', 0.42),
  tone(494, 0.05 + N_BEAT * 10.5, N_EIGHTH * 0.7, 'square', 0.32),
  tone(659, 0.05 + N_BEAT * 11, N_BEAT * 0.45, 'sawtooth', 0.46),
  tone(330, 0.05 + N_BEAT * 11.5, N_BEAT * 0.4, 'sawtooth', 0.42),
];

const NIGHT_LOOP: TNote[] = [...NIGHT_BASS, ...NIGHT_RIFF, ...NIGHT_DRUMS];

// ---------------------------------------------------------------------------
// Finish — торжественный victory fanfare (~100 BPM, мажор C, ~3.2 с)
// доля 0.6 с; спокойнее race-лупов, яркий square lead + мягкий бас
// C3=131 G3=196 E3=165 | C4=262 E4=330 G4=392 C5=523
// ---------------------------------------------------------------------------
const F_BEAT = 0.6;
const F_LOOP = 3.2;

const FINISH_DRUMS: TNote[] = [
  noise(0, 0.1, 0.38, 140),
  noise(F_BEAT, 0.08, 0.22, 3200),
  noise(F_BEAT * 2, 0.1, 0.36, 150),
  noise(F_BEAT * 3, 0.08, 0.2, 3500),
  noise(F_BEAT * 4, 0.12, 0.4, 130),
  noise(F_BEAT * 4.5, 0.06, 0.18, 4000),
];

const FINISH_BASS: TNote[] = [
  ...power(131, 196, 0, F_BEAT * 1.8, 'triangle', 0.2),
  ...power(165, 247, F_BEAT * 2, F_BEAT * 1.6, 'triangle', 0.18),
  ...power(131, 196, F_BEAT * 4, F_BEAT * 1.2, 'triangle', 0.22),
];

/** Восходящий fanfare: C–E–G–C, затем удержание */
const FINISH_LEAD: TNote[] = [
  tone(262, 0.05, F_BEAT * 0.85, 'square', 0.34),
  tone(330, F_BEAT * 0.9, F_BEAT * 0.85, 'square', 0.36),
  tone(392, F_BEAT * 1.8, F_BEAT * 0.9, 'square', 0.38),
  tone(523, F_BEAT * 2.75, F_BEAT * 1.4, 'square', 0.42),
  tone(392, F_BEAT * 4.2, F_BEAT * 0.7, 'sawtooth', 0.3),
  tone(523, F_BEAT * 4.85, F_BEAT * 0.45, 'square', 0.36),
];

const FINISH_LOOP: TNote[] = [...FINISH_BASS, ...FINISH_LEAD, ...FINISH_DRUMS];

// ---------------------------------------------------------------------------
// Storm (Rock 'n' Roll) — boogie bass + sawtooth riff (~132 BPM)
// доля ~0.455 с, петля 5.47 с (12 долей)
// E2=82 B2=123 | A2=110 E3=165 | B2=123 F#3=185 | E3=165 B3=247
// ---------------------------------------------------------------------------
const R_BEAT = 0.455;
const R_EIGHTH = R_BEAT / 2;
const R_LOOP = 5.46;

const STORM_DRUMS: TNote[] = (() => {
  const hits: TNote[] = [];
  for (let beat = 0; beat < 12; beat += 1) {
    const t = beat * R_BEAT;
    // kick on 1,3 snare on 2,4
    if (beat % 2 === 0) {
      hits.push(noise(t, 0.07, 0.44, 130));
    } else {
      hits.push(noise(t, 0.06, 0.38, 180));
    }
    // closed hat on 8ths
    hits.push(noise(t + R_EIGHTH, 0.025, 0.18, 6000));
    // open hat on 4
    if (beat % 4 === 3) {
      hits.push(noise(t, 0.08, 0.14, 8000));
    }
  }
  return hits;
})();

const STORM_BASS: TNote[] = [
  ...power(82, 123, 0, R_BEAT * 1.8, 'square', 0.22),
  ...power(82, 123, R_BEAT * 2, R_BEAT * 1.8, 'square', 0.22),
  ...power(110, 165, R_BEAT * 4, R_BEAT * 1.8, 'square', 0.22),
  ...power(110, 165, R_BEAT * 6, R_BEAT * 1.8, 'square', 0.22),
  ...power(123, 185, R_BEAT * 8, R_BEAT * 1.8, 'square', 0.22),
  ...power(123, 185, R_BEAT * 10, R_BEAT * 1.8, 'square', 0.22),
  ...power(165, 247, R_BEAT * 0, R_BEAT * 1.8, 'triangle', 0.2),
  ...power(165, 247, R_BEAT * 2, R_BEAT * 1.8, 'triangle', 0.2),
  ...power(165, 247, R_BEAT * 4, R_BEAT * 1.8, 'triangle', 0.2),
  ...power(165, 247, R_BEAT * 6, R_BEAT * 1.8, 'triangle', 0.2),
  ...power(165, 247, R_BEAT * 8, R_BEAT * 1.8, 'triangle', 0.2),
  ...power(165, 247, R_BEAT * 10, R_BEAT * 1.8, 'triangle', 0.2),
];

const STORM_RIFF: TNote[] = [
  tone(165, 0.08, R_EIGHTH * 0.8, 'sawtooth', 0.32),
  tone(196, 0.08 + R_EIGHTH, R_EIGHTH * 0.8, 'sawtooth', 0.3),
  tone(220, 0.08 + R_EIGHTH * 2, R_EIGHTH * 0.8, 'sawtooth', 0.34),
  tone(196, 0.08 + R_EIGHTH * 3, R_EIGHTH * 0.8, 'sawtooth', 0.3),
  tone(165, 0.08 + R_EIGHTH * 4, R_EIGHTH * 0.8, 'sawtooth', 0.32),
  tone(147, 0.08 + R_EIGHTH * 5, R_EIGHTH * 0.8, 'sawtooth', 0.3),
  tone(131, 0.08 + R_EIGHTH * 6, R_EIGHTH * 0.8, 'sawtooth', 0.28),
  tone(147, 0.08 + R_EIGHTH * 7, R_EIGHTH * 0.8, 'sawtooth', 0.3),
  // second phrase
  tone(165, R_BEAT * 2.08, R_EIGHTH * 0.8, 'sawtooth', 0.32),
  tone(196, R_BEAT * 2.08 + R_EIGHTH, R_EIGHTH * 0.8, 'sawtooth', 0.3),
  tone(247, R_BEAT * 2.08 + R_EIGHTH * 2, R_BEAT * 0.9, 'sawtooth', 0.36),
  tone(220, R_BEAT * 2.08 + R_EIGHTH * 3, R_EIGHTH * 0.8, 'sawtooth', 0.32),
  tone(196, R_BEAT * 2.08 + R_EIGHTH * 4, R_EIGHTH * 0.8, 'sawtooth', 0.3),
  tone(165, R_BEAT * 2.08 + R_EIGHTH * 5, R_EIGHTH * 0.8, 'sawtooth', 0.28),
  tone(147, R_BEAT * 2.08 + R_EIGHTH * 6, R_BEAT * 0.7, 'sawtooth', 0.3),
  tone(165, R_BEAT * 2.08 + R_EIGHTH * 7, R_EIGHTH * 0.8, 'sawtooth', 0.32),
  // bridge
  tone(123, R_BEAT * 4.08, R_EIGHTH * 0.8, 'sawtooth', 0.32),
  tone(147, R_BEAT * 4.08 + R_EIGHTH, R_EIGHTH * 0.8, 'sawtooth', 0.3),
  tone(165, R_BEAT * 4.08 + R_EIGHTH * 2, R_EIGHTH * 0.8, 'sawtooth', 0.34),
  tone(185, R_BEAT * 4.08 + R_EIGHTH * 3, R_EIGHTH * 0.8, 'sawtooth', 0.32),
  tone(165, R_BEAT * 4.08 + R_EIGHTH * 4, R_EIGHTH * 0.8, 'sawtooth', 0.3),
  tone(147, R_BEAT * 4.08 + R_EIGHTH * 5, R_EIGHTH * 0.8, 'sawtooth', 0.28),
  tone(131, R_BEAT * 4.08 + R_EIGHTH * 6, R_EIGHTH * 0.8, 'sawtooth', 0.3),
  tone(123, R_BEAT * 4.08 + R_EIGHTH * 7, R_EIGHTH * 0.8, 'sawtooth', 0.32),
  // fill
  tone(165, R_BEAT * 6.08, R_EIGHTH * 0.5, 'square', 0.36),
  tone(196, R_BEAT * 6.08 + R_EIGHTH, R_EIGHTH * 0.5, 'square', 0.36),
  tone(220, R_BEAT * 6.08 + R_EIGHTH * 2, R_EIGHTH * 0.5, 'square', 0.36),
  tone(247, R_BEAT * 6.08 + R_EIGHTH * 3, R_EIGHTH * 0.5, 'square', 0.36),
  tone(262, R_BEAT * 6.08 + R_EIGHTH * 4, R_EIGHTH * 0.5, 'square', 0.36),
  tone(294, R_BEAT * 6.08 + R_EIGHTH * 5, R_EIGHTH * 0.5, 'square', 0.36),
  tone(330, R_BEAT * 6.08 + R_EIGHTH * 6, R_BEAT * 0.6, 'sawtooth', 0.42),
];

const STORM_LOOP: TNote[] = [...STORM_BASS, ...STORM_RIFF, ...STORM_DRUMS];

const LOOPS: Record<TRaceMusicTheme, { notes: TNote[]; loopSec: number }> = {
  coastal: { notes: COASTAL_LOOP, loopSec: C_LOOP },
  night: { notes: NIGHT_LOOP, loopSec: N_LOOP },
  rock: { notes: STORM_LOOP, loopSec: R_LOOP },
  finish: { notes: FINISH_LOOP, loopSec: F_LOOP },
};

const MASTER_GAIN = 0.07;
const DEFAULT_NOTE_GAIN = 0.35;

/** Оригинальный chip-rock на Web Audio (в духе Rock n' Roll Racing / SEGA Genesis, не OST) */
export class ChiptuneEngine {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private theme: TRaceMusicTheme | null = null;
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
  start = async (theme: TRaceMusicTheme): Promise<void> => {
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

import type { TDriveSfxSample } from './drive-sfx-bus';
import { mapGravelFromOffroad, shouldPulseKerbTick } from './drive-sfx-map';

/** Тише музыки (~0.1), чтобы SFX не перекрикивали чиптюн */
const MASTER_GAIN = 0.12;
const NOISE_BUFFER_SEC = 2;

type TNoiseLayer = {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
};

/**
 * Procedural driving SFX без непрерывного звука езды:
 * визг шин, скрежет, удары, oil-slap, gravel и kerb tick.
 */
export class DrivingSfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private whiteBuffer: AudioBuffer | null = null;
  private brownBuffer: AudioBuffer | null = null;
  private running = false;
  private paused = false;
  private muted = false;
  private rainEnabled = false;
  private generation = 0;

  private tire: TNoiseLayer | null = null;
  private scrape: TNoiseLayer | null = null;
  private gravel: TNoiseLayer | null = null;
  private rain: TNoiseLayer | null = null;
  private kerbPhase = 0;
  private lastKerbTickAt = 0;

  /** Можно ли звучать */
  private isAudible = (): boolean => this.running && !this.paused && !this.muted;

  /** Master gain по audible */
  private applyMaster = (): void => {
    if (this.master) {
      this.master.gain.value = this.isAudible() ? MASTER_GAIN : 0;
    }
  };

  /** Белый шум */
  private getWhiteBuffer = (ctx: AudioContext): AudioBuffer => {
    if (this.whiteBuffer && this.whiteBuffer.sampleRate === ctx.sampleRate) {
      return this.whiteBuffer;
    }
    const length = Math.floor(ctx.sampleRate * NOISE_BUFFER_SEC);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    this.whiteBuffer = buffer;
    return buffer;
  };

  /** Коричневый шум — удары / oil-slap / gravel */
  private getBrownBuffer = (ctx: AudioContext): AudioBuffer => {
    if (this.brownBuffer && this.brownBuffer.sampleRate === ctx.sampleRate) {
      return this.brownBuffer;
    }
    const length = Math.floor(ctx.sampleRate * NOISE_BUFFER_SEC);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    this.brownBuffer = buffer;
    return buffer;
  };

  /** Looping noise → filter → gain → destination */
  private createNoiseLayer = (
    ctx: AudioContext,
    destination: AudioNode,
    kind: 'white' | 'brown',
    filterType: BiquadFilterType,
    filterFreq: number,
    q = 0.7,
  ): TNoiseLayer => {
    const source = ctx.createBufferSource();
    source.buffer = kind === 'brown' ? this.getBrownBuffer(ctx) : this.getWhiteBuffer(ctx);
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.start();
    return { source, filter, gain };
  };

  /** Плавно ставит gain */
  private setGain = (node: GainNode | null, value: number, when: number, tau = 0.04): void => {
    if (!node) {
      return;
    }
    node.gain.cancelScheduledValues(when);
    node.gain.setTargetAtTime(value <= 0.00005 ? 0.0001 : value, when, tau);
  };

  /** Строит граф непрерывных слоёв */
  private buildGraph = (ctx: AudioContext): void => {
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.2;
    this.compressor.connect(ctx.destination);

    this.master = ctx.createGain();
    this.applyMaster();
    this.master.connect(this.compressor);

    this.tire = this.createNoiseLayer(ctx, this.master, 'white', 'bandpass', 1600, 6);
    this.scrape = this.createNoiseLayer(ctx, this.master, 'white', 'bandpass', 400, 2.2);
    this.gravel = this.createNoiseLayer(ctx, this.master, 'brown', 'lowpass', 700, 0.8);
    this.rain = this.createNoiseLayer(ctx, this.master, 'white', 'bandpass', 4500, 1.5);
  };

  /** One-shot burst (impact / oil / kerb) */
  private playBurst = (
    duration: number,
    peak: number,
    filterType: BiquadFilterType,
    filterFreq: number,
    kind: 'white' | 'brown' = 'white',
  ): void => {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.isAudible() || peak <= 0) {
      return;
    }
    const when = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = kind === 'brown' ? this.getBrownBuffer(ctx) : this.getWhiteBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    filter.Q.value = 1;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), when + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(duration, 0.04));
    src.connect(filter);
    filter.connect(env);
    env.connect(master);
    src.start(when);
    src.stop(when + duration + 0.03);
  };

  /** Старт AudioContext и графа */
  start = async (): Promise<void> => {
    const generation = ++this.generation;
    this.running = true;

    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.buildGraph(this.ctx);
    }
    this.applyMaster();

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    if (generation !== this.generation || !this.running) {
      return;
    }
  };

  /** Пауза без уничтожения графа */
  setPaused = (paused: boolean): void => {
    this.paused = paused;
    this.applyMaster();
  };

  /** Mute без уничтожения графа */
  setMuted = (muted: boolean): void => {
    this.muted = muted;
    this.applyMaster();
  };

  /** Включает слой дождя только для дождливой погоды трассы */
  setRainEnabled = (rainEnabled: boolean): void => {
    this.rainEnabled = rainEnabled;
  };

  /** Обновляет слои из snapshot и one-shot событий */
  update = (sample: TDriveSfxSample, impact: number, oilSlap: number): void => {
    const ctx = this.ctx;
    if (!ctx || !this.running) {
      return;
    }
    const now = ctx.currentTime;
    const live = this.isAudible() && sample.active;

    if (this.isAudible()) {
      if (impact > 0) {
        const thud = 0.55 * impact;
        const crack = 0.4 * impact;
        this.playBurst(0.18 + impact * 0.12, thud, 'lowpass', 160 + impact * 220, 'brown');
        this.playBurst(0.08 + impact * 0.06, crack, 'bandpass', 1100 + impact * 800, 'white');
        this.playBurst(0.05, 0.25 * impact, 'highpass', 2800, 'white');
      }
      if (oilSlap > 0) {
        this.playBurst(0.22, 0.45 * oilSlap, 'lowpass', 380, 'brown');
        this.playBurst(0.14, 0.3 * oilSlap, 'bandpass', 900, 'white');
      }
    }

    if (!live) {
      this.setGain(this.tire?.gain ?? null, 0, now);
      this.setGain(this.scrape?.gain ?? null, 0, now);
      this.setGain(this.gravel?.gain ?? null, 0, now);
      this.setGain(this.rain?.gain ?? null, 0, now);
      return;
    }

    const oilWet = sample.oilStrength > 0.12 || sample.wheelsOnOil > 0;
    const tireGain = sample.skidIntensity * (oilWet ? 0.2 : 0.28);
    if (this.tire) {
      const tireFreq = oilWet
        ? 650 + sample.skidIntensity * 500
        : 1400 + sample.skidIntensity * 1000;
      this.tire.filter.frequency.setTargetAtTime(tireFreq, now, 0.03);
      this.tire.filter.Q.setTargetAtTime(oilWet ? 3.5 : 7, now, 0.04);
      this.setGain(this.tire.gain, tireGain, now, 0.028);
    }

    const scrapeGain = sample.wallScrape * 0.26;
    if (this.scrape) {
      this.scrape.filter.frequency.setTargetAtTime(320 + sample.wallScrape * 600, now, 0.03);
      this.setGain(this.scrape.gain, scrapeGain, now, 0.025);
    }

    const gravelLevel = mapGravelFromOffroad(sample.offRoadStrength, sample.speedMs);
    if (this.gravel) {
      this.gravel.filter.frequency.setTargetAtTime(400 + gravelLevel * 500, now, 0.04);
      this.setGain(this.gravel.gain, gravelLevel * 0.22, now, 0.035);
    }

    if (this.rain) {
      if (this.rainEnabled) {
        const rainGain = 0.04 + sample.speedMs * 0.003;
        this.rain.filter.frequency.setTargetAtTime(3500 + sample.speedMs * 300, now, 0.15);
        this.setGain(this.rain.gain, rainGain, now, 0.2);
      } else {
        this.setGain(this.rain.gain, 0, now, 0.2);
      }
    }

    if (sample.kerbRumble > 0) {
      this.kerbPhase += 0.016 * (4 + sample.kerbRumble * 10 + sample.speedMs * 0.15);
      const phase01 = this.kerbPhase % 1;
      if (
        shouldPulseKerbTick(sample.kerbRumble, phase01) &&
        now - this.lastKerbTickAt > 0.07
      ) {
        this.lastKerbTickAt = now;
        const peak = 0.12 + sample.kerbRumble * 0.22;
        this.playBurst(0.045, peak, 'bandpass', 900 + sample.kerbRumble * 700, 'white');
        this.playBurst(0.035, peak * 0.7, 'highpass', 2200, 'white');
      }
    } else {
      this.kerbPhase = 0;
    }
  };

  /** Останавливает граф и закрывает контекст */
  stop = (): void => {
    this.generation += 1;
    this.running = false;

    const stopOsc = (node: AudioScheduledSourceNode | null) => {
      if (!node) {
        return;
      }
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
      try {
        node.disconnect();
      } catch {
        /* already disconnected */
      }
    };

    stopOsc(this.tire?.source ?? null);
    stopOsc(this.scrape?.source ?? null);
    stopOsc(this.gravel?.source ?? null);

    this.tire = null;
    this.scrape = null;
    this.gravel = null;
    this.rain = null;
    this.kerbPhase = 0;
    this.lastKerbTickAt = 0;
    this.whiteBuffer = null;
    this.brownBuffer = null;

    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.master = null;
      this.compressor = null;
    }
  };
}

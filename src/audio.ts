// Copyright (C) 2026 Yakshawan. SPDX-License-Identifier: AGPL-3.0-or-later
import { Cyclist } from '@strudel/core/cyclist.mjs';
import { Pattern } from '@strudel/core/pattern.mjs';
import { musicPattern, LAYERS, type Layer, type MusicEvent, type Settings } from './music';
import clockUrl from './clock.worklet.js?url';
import { scheduleDuck } from './duck';
import { createMastering, volumeGain } from './mastering';
import { instrumentVoice } from './synth';

interface Scene {
  settings: Settings; cyclist: Cyclist; output: GainNode; input: GainNode;
  layers: Record<Layer, GainNode>; nodes: AudioNode[]; sources: Set<AudioScheduledSourceNode>;
  tick: (() => void) | null; pending?: { settings: Settings; bar: number; pattern: Pattern };
  bassDuck: GainNode; liveRhythm: boolean;
}
export class MusicEngine {
  context: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  playing = false;
  onStop: (() => void) | null = null;
  onError: ((message: string) => void) | null = null;
  private master!: GainNode;
  private mastering: ReturnType<typeof createMastering> | null = null;
  private clock: AudioWorkletNode | null = null;
  private scene: Scene | null = null;
  private retired = new Set<Scene>();
  private noise!: AudioBuffer;
  private impulse!: AudioBuffer;
  private startedAt = 0;
  private stopPromise: Promise<void> | null = null;
  private timerAt: number | null = null;
  private triggered = 0;
  private late = 0;
  private lastError: string | null = null;
  private sceneNumber = 0;
  private duckCount = 0;

  async init() {
    if (this.context) return;
    const context = new AudioContext({ latencyHint: 'playback' });
    this.context = context;
    await context.resume();
    this.mastering = createMastering(context);
    this.master = this.mastering.volume;
    this.analyser = this.mastering.analyser;
    // Reproducible noise/room responses, synthesized once locally, never downloaded.
    let rng = 0x12345678;
    const random = () => { rng ^= rng << 13; rng ^= rng >>> 17; rng ^= rng << 5; return (rng >>> 0) / 4294967296 * 2 - 1; };
    this.noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const noise = this.noise.getChannelData(0);
    for (let i = 0; i < noise.length; i++) noise[i] = random();
    this.impulse = context.createBuffer(2, Math.floor(context.sampleRate * 1.9), context.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = this.impulse.getChannelData(ch);
      for (let i = 0; i < data.length; i++) data[i] = random() * Math.pow(1 - i / data.length, 3.5) * .6;
    }
    try {
      await context.audioWorklet.addModule(clockUrl);
      this.clock = new AudioWorkletNode(context, 'worksong-clock');
      const silence = context.createGain(); silence.gain.value = 0;
      this.clock.connect(silence).connect(context.destination);
      this.clock.port.onmessage = () => {
        this.scene?.tick?.();
        if (this.scene?.pending && this.bar >= this.scene.pending.bar) {
          const pending = this.scene.pending;
          this.scene.settings = pending.settings;
          this.scene.cyclist.setPattern(pending.pattern);
          this.scene.cyclist.setCps(pending.settings.bpm / 240);
          this.scene.pending = undefined;
        }
        if (this.playing && this.timerAt !== null && context.currentTime >= this.timerAt) {
          void this.stop().then(() => this.onStop?.());
        }
      };
    } catch (error) {
      await context.close(); this.context = null;
      throw new Error('이 브라우저에서 오디오 엔진을 시작하지 못했습니다. 최신 Chrome·Edge·Firefox에서 다시 시도해 주세요.', { cause: error });
    }
    // Keep the graph source independent of the UI and avoid default synthesizer/eval imports.
    this.destination = this.mastering.input;
  }
  private destination!: AudioNode;

  async start(settings: Settings) {
    if (this.stopPromise) await this.stopPromise;
    await this.init();
    const context = this.context!;
    await context.resume();
    if (context.state !== 'running') throw new Error('오디오가 잠겨 있습니다. 재생 버튼을 다시 눌러 주세요.');
    if (this.playing) return;
    this.triggered = 0; this.late = 0; this.lastError = null; this.duckCount = 0;
    this.startedAt = context.currentTime;
    this.playing = true;
    this.setVolume(settings.volume);
    this.scene = await this.makeScene(settings, .45);
  }
  private async makeScene(settings: Settings, fade: number): Promise<Scene> {
    const context = this.context!;
    const input = context.createGain();
    const output = context.createGain(); output.gain.value = 0;
    const dry = context.createGain(); dry.gain.value = settings.profile === 'ambient' ? .8 : 1;
    const room = context.createConvolver(); room.buffer = this.impulse;
    const roomHp = context.createBiquadFilter(); roomHp.type = 'highpass'; roomHp.frequency.value = 220;
    const roomFilter = context.createBiquadFilter(); roomFilter.type = 'lowpass'; roomFilter.frequency.value = 3400;
    const wet = context.createGain(); wet.gain.value = settings.profile === 'ambient' ? .35 : .13;
    input.connect(dry).connect(output);
    input.connect(room).connect(roomHp).connect(roomFilter).connect(wet).connect(output);
    const delay = context.createDelay(2); delay.delayTime.value = 60 / settings.bpm * .75;
    const delayFilter = context.createBiquadFilter(); delayFilter.type = 'lowpass'; delayFilter.frequency.value = 1700;
    const feedback = context.createGain(); feedback.gain.value = .27;
    const delayWet = context.createGain(); delayWet.gain.value = settings.profile === 'dub' ? .19 : .075;
    const delayHp = context.createBiquadFilter(); delayHp.type = 'highpass'; delayHp.frequency.value = 220;
    input.connect(delay).connect(delayHp).connect(delayFilter).connect(feedback).connect(delay);
    delayFilter.connect(delayWet).connect(output);
    output.connect(this.destination);
    const bassDuck = context.createGain(); bassDuck.connect(input);
    const layers = Object.fromEntries(LAYERS.map((layer) => {
      const gain = context.createGain(); gain.gain.value = settings.layers[layer] ? 1 : 0;
      gain.connect(layer === 'bass' ? bassDuck : input); return [layer, gain];
    })) as Record<Layer, GainNode>;
    const scene: Scene = { settings, output, input, layers, bassDuck, liveRhythm: settings.layers.rhythm, sources: new Set(), tick: null,
      nodes: [input, output, bassDuck, dry, room, roomHp, roomFilter, wet, delay, delayHp, delayFilter, feedback, delayWet, ...Object.values(layers)], cyclist: null! };
    scene.cyclist = new Cyclist({ getTime: () => context.currentTime, interval: .05, latency: .18,
      setInterval: (callback) => { scene.tick = callback; return ++this.sceneNumber; },
      clearInterval: () => { scene.tick = null; },
      onError: (error) => {
        this.lastError = String(error);
        void this.stop().then(() => this.onError?.('음악 재생 중 오류가 생겼습니다. 정지 후 다시 재생해 주세요.'));
      },
      onTrigger: (hap, _deadline, duration, _cps, time) => {
        if (time < context.currentTime - .015) { this.late++; return; }
        this.triggered++;
        this.voice(scene, hap.value as MusicEvent, Math.max(time, context.currentTime + .003), duration);
      },
    });
    await scene.cyclist.setPattern(musicPattern(settings));
    scene.cyclist.setCps(settings.bpm / 240);
    await scene.cyclist.start();
    output.gain.setValueAtTime(0, context.currentTime);
    output.gain.linearRampToValueAtTime(1, context.currentTime + fade);
    return scene;
  }

  async regenerate(settings: Settings) {
    if (!this.playing) return;
    const old = this.scene;
    this.scene = await this.makeScene(settings, .65);
    if (old) {
      this.retired.add(old);
      old.cyclist.stop();
      this.ramp(old.output.gain, 0, .65);
      setTimeout(() => { this.dispose(old); this.retired.delete(old); }, 900);
    }
  }
  update(settings: Settings) {
    this.setVolume(settings.volume);
    const scene = this.scene;
    if (!scene || !this.playing) return;
    for (const layer of LAYERS) this.ramp(scene.layers[layer].gain, settings.layers[layer] ? 1 : 0, .08);
    scene.liveRhythm = settings.layers.rhythm;
    if (!scene.liveRhythm) this.ramp(scene.bassDuck.gain, 1, .03);
    const oldPattern = musicPattern(scene.settings);
    const newPattern = musicPattern(settings);
    const bar = scene.pending?.bar ?? Math.ceil(this.bar + .2);
    scene.pending = { settings, bar, pattern: newPattern };
    // Both halves are queried by Strudel; an event belongs to its onset side of the boundary.
    void scene.cyclist.setPattern(new Pattern((state) => {
      const begin = Number(state.span.begin), end = Number(state.span.end);
      return [...(begin < bar ? oldPattern.queryArc(begin, Math.min(end, bar)).filter((hap) => Number(hap.whole.begin) < bar) : []),
        ...(end > bar ? newPattern.queryArc(Math.max(begin, bar), end).filter((hap) => Number(hap.whole.begin) >= bar) : [])];
    }));
  }
  setVolume(volume: number) {
    if (this.context) this.ramp(this.master.gain, volumeGain(volume), .08);
  }
  setTimer(minutes: number) {
    this.timerAt = minutes > 0 && this.context && this.playing ? this.context.currentTime + minutes * 60 : null;
  }
  get remaining() { return this.timerAt !== null && this.context ? Math.max(0, this.timerAt - this.context.currentTime) : null; }
  get elapsed() { return this.context && this.playing ? Math.max(0, this.context.currentTime - this.startedAt) : 0; }
  get bar() { return this.scene && this.playing ? Math.max(0, this.scene.cyclist.now() - .18 * this.scene.cyclist.cps) : 0; }
  get pending() { return !!this.scene?.pending; }
  get audibleSettings() { return this.scene?.settings ?? null; }
  diagnostics() {
    return { playing: this.playing, state: this.context?.state ?? 'uninitialized', activeSources: (this.scene?.sources.size ?? 0)
      + Array.from(this.retired).reduce((sum, scene) => sum + scene.sources.size, 0), triggered: this.triggered,
      late: this.late, lastError: this.lastError, bar: this.bar, pending: this.pending, sampleRate: this.context?.sampleRate,
      duckCount: this.duckCount, bassGain: this.scene?.bassDuck.gain.value ?? 1,
      glueReduction: this.mastering?.glue.reduction ?? 0, limiterReduction: this.mastering?.limiter.reduction ?? 0 };
  }
  async stop() {
    if (this.stopPromise) return this.stopPromise;
    if (!this.context) return;
    this.playing = false; this.timerAt = null;
    const scenes = [...this.retired, ...(this.scene ? [this.scene] : [])];
    this.scene = null; this.retired.clear();
    for (const scene of scenes) { scene.cyclist.stop(); this.ramp(scene.output.gain, 0, .2); }
    this.stopPromise = new Promise<void>((resolve) => {
      setTimeout(async () => {
        for (const scene of scenes) this.dispose(scene);
        await this.context?.suspend(); this.stopPromise = null; resolve();
      }, 230);
    });
    return this.stopPromise;
  }
  private dispose(scene: Scene) {
    scene.cyclist.stop();
    for (const source of scene.sources) try { source.stop(); } catch { /* already ended */ }
    for (const node of scene.nodes) node.disconnect();
  }
  private ramp(param: AudioParam, value: number, seconds: number) {
    const now = this.context!.currentTime;
    param.cancelAndHoldAtTime(now); param.linearRampToValueAtTime(value, now + seconds);
  }

  private voice(scene: Scene, event: MusicEvent, time: number, duration: number) {
    const context = this.context!;
    if (event.voice === 'kick' && event.duck && scene.liveRhythm) {
      scheduleDuck(scene.bassDuck.gain, time, event.duck, scene.pending?.settings.bpm ?? scene.settings.bpm, context.currentTime);
      this.duckCount++;
    }
    if (event.instrument) {
      instrumentVoice(context, event, time, duration, this.noise, scene.layers[event.layer], scene.sources);
      return;
    }
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = event.cutoff; filter.Q.value = .5;
    const pan = context.createStereoPanner(); pan.pan.value = event.pan;
    gain.connect(filter).connect(pan).connect(scene.layers[event.layer]);
    const nodes: AudioNode[] = [gain, filter, pan];
    const sources: AudioScheduledSourceNode[] = [];
    const percussion = ['kick', 'snare', 'hat'].includes(event.voice);
    const pad = event.voice === 'pad';
    const bass = event.voice === 'bass';
    const release = pad ? .7 : percussion ? .02 : bass ? .06 : event.voice === 'arp' ? .12
      : scene.settings.generatorVersion === 1 || event.voice === 'keys' ? .3 : scene.settings.profile === 'ambient' ? .45 : scene.settings.profile === 'dub' ? .06 : .08;
    const attack = pad ? .65 : percussion ? .004 : event.voice === 'pluck' && scene.settings.generatorVersion === 2 && scene.settings.profile === 'ambient' ? .04 : .009;
    const hold = percussion ? event.voice === 'kick' ? .24 : event.voice === 'snare' ? .13 : .045 : Math.max(duration, attack + .02);
    const end = time + hold + release;
    const amplitude = event.gain / (event.notes.length || 1);
    const sustain = pad ? .85 : bass ? .65 : .20;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(amplitude, time + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(.00001, amplitude * sustain), time + Math.min(hold, attack + (pad ? .4 : .24)));
    gain.gain.setValueAtTime(Math.max(.00001, amplitude * sustain), time + hold);
    gain.gain.exponentialRampToValueAtTime(.00001, end);
    gain.gain.setValueAtTime(0, end + .005);

    const osc = (frequency: number, type: OscillatorType = 'sine', detune = 0, level = 1) => {
      const source = context.createOscillator(); source.type = type;
      source.frequency.value = frequency; source.detune.value = detune;
      const mix = context.createGain(); mix.gain.value = level;
      source.connect(mix).connect(gain); nodes.push(mix); sources.push(source);
      return source;
    };
    if (event.voice === 'kick') {
      const source = osc(100);
      source.frequency.setValueAtTime(105, time);
      source.frequency.exponentialRampToValueAtTime(46, time + .08);
      filter.frequency.value = 420;
    } else if (event.voice === 'snare' || event.voice === 'hat') {
      const noise = context.createBufferSource(); noise.buffer = this.noise;
      const hp = context.createBiquadFilter(); hp.type = 'highpass';
      hp.frequency.value = event.voice === 'hat' ? 5400 : 1200;
      noise.connect(hp).connect(gain); nodes.push(hp); sources.push(noise);
      filter.frequency.value = event.voice === 'hat' ? 8200 : 4800;
      if (event.voice === 'snare') osc(180, 'sine', 0, .35);
    } else {
      for (const note of event.notes) {
        const frequency = 440 * 2 ** ((note - 69) / 12);
        if (pad) {
          osc(frequency, 'triangle', -3, .6); osc(frequency, 'sine', 3, .4);
        } else if (bass) {
          osc(frequency, 'sine', 0, .82); osc(frequency, 'triangle', 0, .18);
          filter.frequency.value = 480;
        } else {
          const carrier = osc(frequency);
          const modulator = context.createOscillator(); modulator.frequency.value = frequency * 2;
          const modulation = context.createGain();
          modulation.gain.setValueAtTime(frequency * (event.voice === 'keys' ? .75 : event.voice === 'arp' ? .65 : 1.25), time);
          modulation.gain.exponentialRampToValueAtTime(.001, time + .45);
          modulator.connect(modulation).connect(carrier.frequency);
          nodes.push(modulation); sources.push(modulator);
          osc(frequency, 'triangle', 0, .16);
        }
      }
    }
    let alive = sources.length;
    for (const source of sources) {
      scene.sources.add(source);
      source.onended = () => {
        scene.sources.delete(source); source.disconnect();
        if (--alive === 0) for (const node of nodes) node.disconnect();
      };
      source.start(time); source.stop(end + .015);
    }
  }
}

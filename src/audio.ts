// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import {prepareDrums, type DrumBank} from './drum-bank';
import {createDrumBus, drumVoice, drumRoomGain, type DrumBus, type HatVoice} from './drums';
import { ownVoice } from './source-lifecycle';
import { Transport } from './transport';
import { AUDIO_LAYERS, layerEnabled, type AudioLayer, type MusicEvent, type Settings } from './music';
import {playbackScore,playbackChord,capturePhrase,relativeEvent,compositionIdentity,type Playback,type SavedPhrase} from './saved-phrase';
import clockUrl from './clock.worklet.js?url';
import { scheduleDuck } from './duck';
import { createMastering, volumeGain } from './mastering';
import { instrumentVoice } from './synth';
import { createRoom, createAmbientImpulse, reverbGain } from './reverb';

// Lift the sparse arpeggio above masking by the chord/bass bus (+7.2 dB).
const layerGain = (s:Settings, layer:AudioLayer) => layerEnabled(s,layer) ? layer==='arpeggio' ? 2.3 : 1 : 0;

interface Scene {
  disposed?:boolean; retirement?:ReturnType<typeof setTimeout>;
  settings: Settings; playback: Playback; transport: Transport<Playback>; output: GainNode; input: GainNode;
  layers: Record<AudioLayer, GainNode>; nodes: AudioNode[]; sources: Set<AudioScheduledSourceNode>; cleanups: Set<() => void>;
  meters: Record<AudioLayer, {node:AnalyserNode; samples:Float32Array<ArrayBuffer>}>;
  bassDuck: GainNode; liveRhythm: boolean; roomWet: GainNode; drums: DrumBus; hats: HatVoice[];
}
export class MusicEngine {
  context: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  playing = false;
  revision = 0;
  onStop: (() => void) | null = null;
  onBeforeStop: (() => void) | null = null;
  onError: ((message: string) => void) | null = null;
  private master!: GainNode;
  private mastering: ReturnType<typeof createMastering> | null = null;
  private clock: AudioWorkletNode | null = null;
  private scene: Scene | null = null;
  private retired = new Set<Scene>();
  private drumBank!: DrumBank;
  private noise!: AudioBuffer;
  private impulse!: AudioBuffer;
  private ambientImpulse?: AudioBuffer;
  private startedAt = 0;
  private lifecycle = 0;
  private initPromise: Promise<void> | null = null;
  private stopPromise: Promise<void> | null = null;
  private timerAt: number | null = null;
  private triggered = 0;
  private arpeggioTriggered = 0;
  private late = 0;
  private lastError: string | null = null;
  private duckCount = 0;

  async init() {
    if (this.initPromise) return this.initPromise;
    if (this.context) return;
    this.initPromise = this.initialize();
    try { await this.initPromise; } finally { this.initPromise = null; }
  }
  private async initialize() {
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
      this.drumBank = await prepareDrums(context);
      await context.audioWorklet.addModule(clockUrl);
      this.clock = new AudioWorkletNode(context, 'worksong-clock');
      const silence = context.createGain(); silence.gain.value = 0;
      this.clock.connect(silence).connect(context.destination);
      this.clock.port.onmessage = () => {
        this.scene?.transport.tick();
        if (this.playing && this.timerAt !== null && context.currentTime >= this.timerAt) {
          void this.stop().then(() => this.onStop?.());
        }
      };
    } catch (error) {
      await context.close(); this.context = null;
      throw new Error('AUDIO_UNAVAILABLE', { cause: error });
    }
    // Keep the graph source independent of the UI and avoid default synthesizer/eval imports.
    this.destination = this.mastering.input;
  }
  private destination!: AudioNode;

  async start(settings: Settings, phrase?:SavedPhrase) {
    if (this.playing) return;
    const token = ++this.lifecycle;
    if (this.stopPromise) await this.stopPromise;
    await this.init();
    if (token !== this.lifecycle) return;
    const context = this.context!;
    await context.resume();
    if (token !== this.lifecycle) return;
    if (context.state !== 'running') throw new Error('AUDIO_LOCKED');
    if (this.playing) return;
    this.triggered = 0; this.arpeggioTriggered = 0; this.late = 0; this.lastError = null; this.duckCount = 0;
    this.startedAt = context.currentTime;
    this.playing = true;
    this.setVolume(settings.volume);
    this.scene = this.makeScene(settings, .45,phrase);this.revision++;
  }
  private makeScene(settings: Settings, fade: number, phrase?:SavedPhrase): Scene {
    const context = this.context!;
    const ambient=settings.profile==='ambient'&&settings.generatorVersion>=13;
    const input = context.createGain();
    const output = context.createGain(); output.gain.value = 0;
    const dry = context.createGain(); dry.gain.value = settings.profile === 'ambient' ? .8 : 1;
    if(ambient&&!this.ambientImpulse)this.ambientImpulse=createAmbientImpulse(context);
    const room = createRoom(context, ambient?this.ambientImpulse!:this.impulse, settings.reverb,ambient);
    input.connect(dry).connect(output);
    if(!ambient)input.connect(room.input);room.wet.connect(output);
    const halfTime = settings.generatorVersion >= 4 && settings.profile === 'dub' && settings.groove === 'dnb';
    const delay = context.createDelay(2); delay.delayTime.value = 60 / settings.bpm * (halfTime ? 1.5 : .75);
    const delayFilter = context.createBiquadFilter(); delayFilter.type = 'lowpass'; delayFilter.frequency.value = 1700;
    const feedback = context.createGain(); feedback.gain.value = .27;
    const delayWet = context.createGain(); delayWet.gain.value = ambient?0:halfTime ? .09 : settings.profile === 'dub' ? .19 : .075;
    const delayHp = context.createBiquadFilter(); delayHp.type = 'highpass'; delayHp.frequency.value = 220;
    input.connect(delay).connect(delayHp).connect(delayFilter).connect(feedback).connect(delay);
    delayFilter.connect(delayWet).connect(output);
    output.connect(this.destination);
    const bassDuck = context.createGain();
    const drums = createDrumBus(context, settings);
    const sends:GainNode[]=[];
    const meters = Object.fromEntries(AUDIO_LAYERS.map(layer=>{
      const node=context.createAnalyser();node.fftSize=256;
      return [layer,{node,samples:new Float32Array(256)}];
    })) as Scene['meters'];
    const layers = Object.fromEntries(AUDIO_LAYERS.map((layer) => {
      const gain = context.createGain(); gain.gain.value = layerGain(settings, layer);
      if(layer==='bass')gain.connect(bassDuck).connect(meters[layer].node);
      else gain.connect(meters[layer].node);
      meters[layer].node.connect(layer==='rhythm'?output:input);return [layer,gain];
    })) as Record<AudioLayer, GainNode>;
    if(ambient)for(const layer of ['harmony','bass','motif','arpeggio'] as const){
      const send=context.createGain();send.gain.value={harmony:.78,bass:.08,motif:1,arpeggio:.62}[layer];
      meters[layer].node.connect(send).connect(room.input);sends.push(send);
    }
    drums.output.connect(layers.rhythm);
    const playback:Playback={settings:structuredClone(settings),phrase:phrase?structuredClone(phrase):undefined,opening:true};
    const scene: Scene = { drums, hats: [], settings, playback, output, input, layers, meters, bassDuck, roomWet: room.wet, liveRhythm: settings.layers.rhythm, sources: new Set(), cleanups: new Set(),
      nodes: [...drums.nodes, input, output, bassDuck, dry, ...room.nodes, ...sends, delay, delayHp, delayFilter, feedback, delayWet, ...Object.values(layers), ...Object.values(meters).map(m=>m.node)], transport: null! };
    scene.transport = new Transport<Playback>({
      clock: () => context.currentTime,
      onError: (error) => {
        this.lastError = String(error);
        void this.stop().then(() => this.onError?.('AUDIO_PLAYBACK'));
      },
      trigger: (event, time, duration, bpm, render) => {
        if (time < context.currentTime - .015) { this.late++; return; }
        this.triggered++;
        if(event.layer==='arpeggio')this.arpeggioTriggered++;
        this.voice(scene, event, Math.max(time, context.currentTime + .003), duration, bpm, render.settings);
      },
    });
    scene.transport.start(playbackScore(playback), settings.bpm, playback);
    output.gain.setValueAtTime(0, context.currentTime);
    output.gain.linearRampToValueAtTime(1, context.currentTime + fade);
    return scene;
  }

  async regenerate(settings: Settings,phrase?:SavedPhrase) {
    if (!this.playing) return;
    const old = this.scene;
    const fade=(settings.profile==='ambient'&&settings.generatorVersion>=13)||(old?.settings.profile==='ambient'&&old.settings.generatorVersion>=13)?1.6:.65;
    this.scene = this.makeScene(settings, fade,phrase);this.revision++;
    this.startedAt=this.context!.currentTime;
    if (old) {
      this.retired.add(old);
      old.transport.stop();
      this.ramp(old.output.gain, 0, fade);
      old.retirement=setTimeout(() => { this.dispose(old); this.retired.delete(old); }, (fade+.25)*1000);
    }
  }
  update(settings: Settings) {
    this.setVolume(settings.volume);
    this.setReverb(settings.reverb);
    const scene = this.scene;
    if (!scene || !this.playing) return;
    const ambient=(s:Settings)=>s.profile==='ambient'&&s.generatorVersion>=13;
    if(ambient(scene.settings)!==ambient(settings)){void this.regenerate(settings);return;}
    for (const layer of AUDIO_LAYERS) this.ramp(scene.layers[layer].gain, layerGain(settings, layer), .08);
    scene.liveRhythm = settings.layers.rhythm;
    if (!scene.liveRhythm) this.ramp(scene.bassDuck.gain, 1, .03);
    const playback:Playback={settings:structuredClone(settings),phrase:scene.playback.phrase,
      opening:scene.playback.opening&&compositionIdentity(settings)===compositionIdentity(scene.playback.settings)};
    scene.transport.queue(playbackScore(playback), settings.bpm, () => {
      // The audio for this boundary has already been reserved at the new tempo.
      scene.settings = { ...settings, reverb: scene.settings.reverb };
      scene.playback=playback;
    }, playback);
    this.revision++;
  }

  setVolume(volume: number) {
    if (this.context) this.ramp(this.master.gain, volumeGain(volume), .08);
  }
  setReverb(amount: number) {
    if (!this.context) return;
    for (const scene of [...this.retired, ...(this.scene ? [this.scene] : [])]) {
      this.ramp(scene.roomWet.gain, reverbGain(amount), .12);
      this.ramp(scene.drums.wet.gain, drumRoomGain(amount), .12);
      scene.settings = { ...scene.settings, reverb: amount };
    }
  }
  setTimer(minutes: number) {
    this.timerAt = minutes > 0 && this.context && this.playing ? this.context.currentTime + minutes * 60 : null;
  }
  get remaining() { return this.timerAt !== null && this.context ? Math.max(0, this.timerAt - this.context.currentTime) : null; }
  get elapsed() { return this.context && this.playing ? Math.max(0, this.context.currentTime - this.startedAt) : 0; }
  get bar() { return this.scene && this.playing ? this.scene.transport.position : 0; }
  get pending() { return !!this.scene?.transport.pending; }
  get audibleSettings() { return this.scene?.settings ?? null; }
  capture(settings:Settings,phrase?:SavedPhrase):{settings:Settings;phrase:SavedPhrase}{
    const scene=this.scene;
    if(!scene||!this.playing)return {settings:structuredClone(settings),phrase:capturePhrase({settings,phrase,opening:true})};
    const bar=this.bar,start=Math.floor(bar/8)*8,parts=scene.transport.window(start,start+8);
    const audible=parts.find(p=>p.from<=bar&&p.to>bar)?.render??scene.playback;
    return {settings:structuredClone({...parts.at(-1)!.render.settings,volume:settings.volume,reverb:settings.reverb,layers:settings.layers}),
      phrase:{version:1,sourceBar:(scene.playback.phrase?.sourceBar??0)+start,
        events:parts.flatMap(part=>part.score.onsets(part.from,part.to)).map(e=>relativeEvent(e,start)).sort((a,b)=>a.at-b.at),
        chords:Array.from({length:8},(_,i)=>structuredClone(playbackChord(parts.find(p=>p.from<=start+i&&p.to>start+i)?.render??audible,start+i)))}};
  }
  get harmonyWindow(){
    const scene=this.scene;if(!scene||!this.playing)return null;
    const bar=this.bar,start=Math.floor(bar/8)*8,parts=scene.transport.window(start,start+8);
    return {bar:bar-start,chords:Array.from({length:8},(_,i)=>playbackChord(parts.find(p=>p.from<=start+i&&p.to>start+i)?.render??scene.playback,start+i))};
  }
  readLayerActivity():Record<AudioLayer,number>{
    const levels:Record<AudioLayer,number>={harmony:0,bass:0,rhythm:0,motif:0,arpeggio:0};
    if(!this.playing||!this.master||this.context?.state!=='running')return levels;
    // Meter actual part audio after mute/ducking; shared delay/reverb tails stay in the scope.
    const reference:Record<AudioLayer,number>={harmony:.014,bass:.055,rhythm:.035,motif:.013,arpeggio:.018};
    for(const scene of [...this.retired,...(this.scene?[this.scene]:[])])for(const layer of AUDIO_LAYERS){
      const meter=scene.meters[layer];meter.node.getFloatTimeDomainData(meter.samples);
      let sum=0;for(const sample of meter.samples)sum+=sample*sample;
      const rms=Math.sqrt(sum/meter.samples.length)*scene.output.gain.value*this.master.gain.value;
      levels[layer]+=rms*rms;
    }
    for(const layer of AUDIO_LAYERS){
      const rms=Math.sqrt(levels[layer]);levels[layer]=rms<.00015?0:Math.min(1,Math.pow(rms/reference[layer],.55));
    }
    return levels;
  }
  diagnostics() {
    return { playing: this.playing, state: this.context?.state ?? 'uninitialized', activeSources: (this.scene?.sources.size ?? 0)
      + Array.from(this.retired).reduce((sum, scene) => sum + scene.sources.size, 0), triggered: this.triggered, arpeggioTriggered: this.arpeggioTriggered,
      late: this.late, clockStalls: this.scene?.transport.stalled ?? 0, lastError: this.lastError, bar: this.bar, pending: this.pending, sampleRate: this.context?.sampleRate,
      sourceBar:this.bar+(this.scene?.playback.phrase?.sourceBar??0),savedOpening:!!this.scene?.playback.phrase&&this.scene.playback.opening&&this.bar<8,
      reverbWet: this.scene?.roomWet.gain.value ?? 0, duckCount: this.duckCount, bassGain: this.scene?.bassDuck.gain.value ?? 1,
      drumBank: this.drumBank ? {sounds:this.drumBank.size, bytes:this.drumBank.bytes} : null,
      drumReduction: this.scene?.drums?.glue.reduction ?? 0,
      glueReduction: this.mastering?.glue.reduction ?? 0, limiterReduction: this.mastering?.limiter.reduction ?? 0 };
  }
  async stop() {
    this.lifecycle++;
    if (this.stopPromise) return this.stopPromise;
    if (!this.context) return;
    if(this.playing){try{this.onBeforeStop?.();}catch{/* Saving a view must never prevent audio cleanup. */}}
    this.playing = false; this.timerAt = null;
    const scenes = [...this.retired, ...(this.scene ? [this.scene] : [])];
    this.scene = null; this.retired.clear();
    for (const scene of scenes) { scene.transport.stop(); this.ramp(scene.output.gain, 0, .2); }
    this.stopPromise = new Promise<void>((resolve) => {
      setTimeout(async () => {
        for (const scene of scenes) this.dispose(scene);
        await this.context?.suspend(); this.stopPromise = null; resolve();
      }, 230);
    });
    return this.stopPromise;
  }
  private dispose(scene: Scene) {
    if(scene.disposed)return;scene.disposed=true;
    if(scene.retirement)clearTimeout(scene.retirement);
    scene.transport.stop();
    for (const cleanup of scene.cleanups) cleanup();
    for (const node of scene.nodes) node.disconnect();
  }
  private ramp(param: AudioParam, value: number, seconds: number) {
    const now = this.context!.currentTime;
    param.cancelAndHoldAtTime(now); param.linearRampToValueAtTime(value, now + seconds);
  }

  private voice(scene: Scene, event: MusicEvent, time: number, duration: number, bpm = scene.settings.bpm, render = scene.settings) {
    const context = this.context!;
    if (event.voice === 'kick' && event.duck && scene.liveRhythm) {
      scheduleDuck(scene.bassDuck.gain, time, event.duck, bpm, context.currentTime);
      this.duckCount++;
    }
    if (event.layer === 'rhythm') {
      drumVoice(context, this.drumBank, scene.drums, scene.hats, event, time, render, scene.sources, scene.cleanups);
      return;
    }
    if (event.instrument) {
      instrumentVoice(context, event, time, duration, this.noise, scene.layers[event.layer], scene.sources, scene.cleanups,render.profile==='ambient'&&render.generatorVersion>=13);
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
      : render.generatorVersion === 1 || event.voice === 'keys' ? .3 : render.profile === 'ambient' ? .45 : render.profile === 'dub' ? .06 : .08;
    const attack = pad ? .65 : percussion ? .004 : event.voice === 'pluck' && render.generatorVersion === 2 && render.profile === 'ambient' ? .04 : .009;
    const hold = percussion ? event.voice === 'kick' ? .24 : event.voice === 'snare' ? .13 : .045 : Math.max(duration, attack + .02);
    const end = time + hold + release;
    const amplitude = event.gain / (event.notes.length || 1);
    const sustain = pad ? .85 : bass ? .65 : .20;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(amplitude, time + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(.00001, amplitude * sustain), time + Math.min(hold, attack + (pad ? .4 : .24)));
    gain.gain.setValueAtTime(Math.max(.00001, amplitude * sustain), time + hold);
    gain.gain.exponentialRampToValueAtTime(.00001, end);
    gain.gain.linearRampToValueAtTime(0, end + .005);

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
    ownVoice(sources, nodes, scene.sources, scene.cleanups);
    for (const source of sources) {
      source.start(time); source.stop(end + .015);
    }
  }
}

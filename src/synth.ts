// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { MusicEvent } from './music';
import { ownVoice } from './source-lifecycle';
import { random } from './seed';

// Small, locally synthesized palettes. Struck bodies decay continuously; sustained
// instruments keep a breath/bow envelope. The score and bass gate remain unchanged.
export function instrumentVoice(context: BaseAudioContext, event: MusicEvent, time: number, duration: number,
  noiseBuffer: AudioBuffer, destination: AudioNode, active: Set<AudioScheduledSourceNode>, cleanups?: Set<() => void>) {
  const id = event.instrument!, percussion = event.layer === 'rhythm', bass = event.layer === 'bass';
  if ((!percussion && !event.notes.length) || !Number.isFinite(event.gain) || event.gain <= 0 || !Number.isFinite(duration) || duration <= 0) return;
  const variation = random(id, `${event.at}:${event.notes.join(',')}:${event.voice}`);
  const velocity = Math.min(1, Math.max(.15, event.gain / (bass ? .18 : event.layer === 'harmony' ? .12 : .075)));
  const gain = context.createGain(), filter = context.createBiquadFilter(), pan = context.createStereoPanner();
  filter.type = 'lowpass'; filter.frequency.value = event.cutoff; filter.Q.value = .55; pan.pan.value = event.pan;
  gain.connect(filter).connect(pan).connect(destination);
  const nodes: AudioNode[] = [gain, filter, pan], sources: AudioScheduledSourceNode[] = [];
  let attack = .006, release = .24, decay = .65, sustain = 0, level = 1, hold = duration;
  if (id === 'h-felt') { attack = .006; decay = 1.35; release = .34; level = .94; }
  if (id === 'h-electric') { decay = 1.6; release = .40; level = .92; }
  if (id === 'h-organ') { attack = .025; sustain = .72; release = .16; level = .64; }
  if (id === 'h-pad') { attack = Math.min(.28, duration * .3); sustain = .80; release = .58; level = .85; }
  if (id === 'm-bell') { attack = .003; decay = 1.05; release = .52; level = .85; }
  if (id === 'm-marimba') { attack = .003; decay = .30; release = .18; level = 1.12; }
  if (id === 'm-flute') { attack = Math.min(.055, duration * .25); sustain = .85; release = .18; level = .64; }
  if (id === 'm-pluck') { attack = .004; decay = .42; release = .22; level = .88; }
  if (bass) {
    attack = .007; release = .055; decay = id === 'b-pluck' ? .30 : 2.4;
    sustain = id === 'b-sub' ? .78 : 0;
    level = id === 'b-analog' ? .74 : id === 'b-sub' ? 1.12 : 1;
    filter.frequency.value = id === 'b-analog' ? 650 : id === 'b-pluck' ? 850 : 440;
  }
  if (percussion) {
    attack = .002; release = .025;
    hold = event.voice === 'tom' ? .23 : event.voice === 'rim' ? .075 : event.voice === 'kick' ? (id === 'r-click' ? .13 : id === 'r-brush' ? .18 : .24)
      : event.voice === 'snare' ? (id === 'r-brush' ? .22 : id === 'r-click' ? .07 : .16) : id === 'r-brush' ? .10 : .065;
    decay = hold / (event.voice === 'hat' ? 4 : 3.5);
    level = id === 'r-brush' ? .78 : id === 'r-click' ? .80 : 1;
  }
  hold = Math.max(hold, attack + .012);
  const end = time + hold + release;
  const amplitude = event.gain * level * (.97 + variation * .06) / Math.max(1, event.notes.length);
  const epsilon = 1e-6;
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(amplitude, time + attack);
  // Two slopes for breath/sustained sounds; uninterrupted natural decay for strikes.
  const decayEnd = Math.min(hold, attack + .18);
  if (sustain) {
    gain.gain.exponentialRampToValueAtTime(Math.max(epsilon, amplitude * sustain), time + decayEnd);
    gain.gain.exponentialRampToValueAtTime(Math.max(epsilon, amplitude * sustain * .90), time + hold);
  } else {
    gain.gain.exponentialRampToValueAtTime(Math.max(epsilon, amplitude * Math.exp(-(hold - attack) / decay)), time + hold);
  }
  gain.gain.exponentialRampToValueAtTime(epsilon, end);
  gain.gain.linearRampToValueAtTime(0, end + .005);
  if (!percussion) {
    const brightness = Math.min(context.sampleRate * .45, filter.frequency.value * (.8 + velocity * .35));
    filter.frequency.setValueAtTime(brightness, time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, brightness * (sustain ? .83 : bass ? .63 : .50)), time + Math.min(hold, bass ? .22 : .7));
  }
  const osc = (frequency: number, type: OscillatorType = 'sine', amount = 1, detune = 0, partialDecay = 0) => {
    const source = context.createOscillator(), mix = context.createGain();
    source.type = type; source.frequency.value = Math.min(frequency, context.sampleRate * .45); source.detune.value = detune;
    mix.gain.setValueAtTime(amount, time);
    if (partialDecay) mix.gain.setTargetAtTime(0, time, partialDecay);
    source.connect(mix).connect(gain); nodes.push(mix); sources.push(source); return source;
  };
  const fm = (frequency: number, ratio: number, index: number, decayTime: number, amount = 1) => {
    const carrier = osc(frequency, 'sine', amount), mod = context.createOscillator(), depth = context.createGain();
    mod.frequency.value = frequency * ratio;
    depth.gain.setValueAtTime(frequency * index * (.55 + velocity * .45), time);
    depth.gain.setTargetAtTime(0, time, decayTime);
    mod.connect(depth).connect(carrier.frequency); sources.push(mod); nodes.push(depth); return carrier;
  };
  const noise = (frequency: number, amount: number, decayTime = 0, bandpass = false) => {
    const source = context.createBufferSource(), tone = context.createBiquadFilter(), mix = context.createGain();
    source.buffer = noiseBuffer; source.loop = true;
    // Different attacks read different parts of the same deterministic noise buffer.
    source.loopStart = variation * .7; source.loopEnd = noiseBuffer.duration;
    tone.type = bandpass ? 'bandpass' : 'highpass'; tone.frequency.value = frequency; tone.Q.value = .7;
    mix.gain.setValueAtTime(amount, time); if (decayTime) mix.gain.setTargetAtTime(0, time, decayTime);
    source.connect(tone).connect(mix).connect(gain); sources.push(source); nodes.push(tone, mix);
  };
  const vibrato = (carriers: OscillatorNode[], depthCents: number, rate: number) => {
    const lfo = context.createOscillator(), depth = context.createGain(); lfo.frequency.value = rate;
    depth.gain.setValueAtTime(0, time);
    depth.gain.setValueAtTime(0, time + Math.min(.16, hold * .25));
    depth.gain.linearRampToValueAtTime(depthCents, time + Math.min(.45, hold * .75));
    lfo.connect(depth); for (const carrier of carriers) depth.connect(carrier.detune);
    sources.push(lfo); nodes.push(depth);
  };
  if (percussion) {
    if (event.voice === 'kick') {
      const start = id === 'r-electro' ? 135 : id === 'r-click' ? 165 : id === 'r-brush' ? 85 : 110;
      const bottom = id === 'r-electro' ? 42 : id === 'r-click' ? 65 : 48;
      const source = osc(start); source.frequency.setValueAtTime(start, time);
      source.frequency.exponentialRampToValueAtTime(bottom, time + (id === 'r-click' ? .035 : .085));
      filter.frequency.value = id === 'r-click' ? 950 : 500;
      noise(700, .10, .008, true);
      if (id === 'r-electro') osc(bottom, 'triangle', .13, 0, .12);
    } else if (event.voice === 'tom') {
      const f=440*2**(((event.notes[0]??48)-69)/12),body=osc(f*1.35);
      body.frequency.exponentialRampToValueAtTime(f,time+.045);
      osc(f*1.58,'sine',.20,0,.05);noise(1200,.09,.018,true);
      filter.frequency.value=id==='r-brush'?1600:2300;
    } else if (event.voice === 'rim') {
      osc(780,'sine',.55,0,.014);osc(1260,'sine',.32,0,.008);noise(2300,.2,.009,true);
      filter.frequency.value=id==='r-brush'?2700:4600;
    } else if (event.voice === 'snare') {
      noise(id === 'r-brush' ? 650 : id === 'r-click' ? 2100 : 1200, id === 'r-brush' ? .85 : .7);
      if (id !== 'r-brush') { osc(id === 'r-click' ? 400 : 185, 'sine', .28, 0, .055); osc(330, 'sine', .10, 0, .025); }
      filter.frequency.value = id === 'r-tape' ? 3400 : id === 'r-brush' ? 4200 : 6500;
    } else {
      if (id === 'r-electro') { osc(7100, 'square', .12, 0, .02); osc(9300, 'square', .09, 0, .015); noise(5800, .45); }
      else noise(id === 'r-brush' ? 3700 : id === 'r-click' ? 7200 : 5000, id === 'r-click' ? .75 : 1);
      filter.frequency.value = id === 'r-brush' ? 6400 : 9200;
    }
  } else for (const note of event.notes) {
    const f = 440 * 2 ** ((note - 69) / 12), detune = (random(id, `${event.at}:${note}`) - .5) * 3;
    switch (id) {
      case 'h-felt':
        osc(f, 'sine', .70, detune); osc(f * 2.001, 'sine', .19 * velocity, detune, .7);
        osc(f * 3.004, 'sine', .085 * velocity, detune, .28); osc(f * 4.009, 'sine', .025, detune, .12);
        noise(1500, .025, .012, true); break;
      case 'h-electric':
        fm(f, 2, .85, .25, .85); osc(f * 2, 'sine', .12, detune, .55); noise(2200, .012, .008, true); break;
      case 'h-organ': {
        const carriers = [osc(f, 'sine', .64), osc(f * 2, 'sine', .23), osc(f * 3, 'sine', .10)];
        vibrato(carriers, 2.5, 5.1); break;
      }
      case 'h-pad': {
        const carriers = [osc(f, 'triangle', .40, -4 + detune), osc(f, 'sine', .45, 4 + detune), osc(f * 2, 'sine', .09, 1)];
        vibrato(carriers, 3, .7 + variation * .15); break;
      }
      case 'b-sub': osc(f, 'sine'); break;
      case 'b-round': osc(f, 'sine', .78); osc(f, 'triangle', .22, 0, .5); break;
      case 'b-pluck': fm(f, 1, .75, .065, .8); osc(f * 2, 'sine', .18, 0, .10); break;
      case 'b-analog': osc(f, 'sawtooth', .26, -3); osc(f, 'triangle', .3, 3); osc(f, 'sine', .44); break;
      case 'm-bell':
        osc(f, 'sine', .76, detune); osc(f * 2.756, 'sine', .15, detune, .38); osc(f * 5.404, 'sine', .055, detune, .16); break;
      case 'm-marimba':
        osc(f, 'sine', .80, detune); osc(f * 3.99, 'sine', .17, detune, .045); osc(f * 10, 'sine', .025, detune, .018);
        noise(1200, .022, .01, true); break;
      case 'm-flute': {
        const carriers = [osc(f, 'sine', .82, detune), osc(f * 2, 'sine', .13, detune), osc(f * 3, 'sine', .04, detune)];
        noise(1800, .055 + velocity * .025, 0, true); vibrato(carriers, 7 + velocity * 3, 4.8 + variation * .5); break;
      }
      case 'm-pluck':
        osc(f, 'triangle', .74, detune); osc(f * 2, 'sine', .18, detune, .12); osc(f * 3, 'sine', .07, detune, .055);
        noise(2400, .028, .01, true); break;
      default: osc(f);
    }
  }
  ownVoice(sources, nodes, active, cleanups);
  for (const source of sources) {
    if (source instanceof AudioBufferSourceNode) source.start(time, variation * .7); else source.start(time);
    source.stop(end + .015);
  }
}

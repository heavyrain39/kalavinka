// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { Settings } from './music';

// Generator v21 lo-fi "tape" stage on the scene mix: slow pitch wow, gentle saturation,
// a high roll-off and a quiet vinyl/tape noise bed. Everything is synthesized locally and
// deterministically; the warmth slider sets how much of it is heard.
export const tapeEnabled = (s: Settings) => s.profile === 'lofi' && s.generatorVersion >= 21;
/** 0 below warmth 20, 1 at warmth 100 (default 72 → .65). */
export const tapeAmount = (warmth: number) => Math.min(1, Math.max(0, (warmth - 20) / 80));
export const tapeCutoff = (warmth: number) => 15000 - 6500 * tapeAmount(warmth);
const wowCents = (warmth: number) => 1.5 + 4 * tapeAmount(warmth);
const BASE_DELAY = .012;
// Two slow, incommensurate sines: the wow never lines up with the bar, nothing is random.
const WOW = [{ rate: .47, share: .7 }, { rate: .113, share: .3 }];
export const HISS_LEVEL = .00045, CRACKLE_LEVEL = 1, SAT_DRIVE = 1.25;

/** Delay modulation depth (seconds) for a given pitch deviation (cents) at an LFO rate. */
export const wowDepth = (cents: number, rate: number) => (2 ** (cents / 1200) - 1) / (2 * Math.PI * rate);

/** Soft, slightly asymmetric curve with unity slope at zero (tape-like even/odd colour). */
export function tapeCurve(x: number, drive = 1.6, bias = .08) {
  const t0 = Math.tanh(drive * bias), slope = drive * (1 - t0 * t0);
  return (Math.tanh(drive * (x + bias)) - t0) / slope;
}

/** A looped, deterministic noise bed: soft hiss plus sparse crackle ticks and rare pops. */
export function createTapeNoise(context: BaseAudioContext, seconds = 11.3): AudioBuffer {
  const rate = context.sampleRate, length = Math.floor(rate * seconds);
  const buffer = context.createBuffer(2, length, rate);
  let rng = 0x5eed1e;
  const next = () => { rng ^= rng << 13; rng ^= rng >>> 17; rng ^= rng << 5; return (rng >>> 0) / 4294967296; };
  const hissL = new Float32Array(length), hissR = new Float32Array(length), crackle = new Float32Array(length);
  // Hiss: white noise band-limited to roughly 250 Hz – 4.5 kHz (dark, so it never brightens the mix).
  for (const data of [hissL, hissR]) {
    const lp = Math.exp(-2 * Math.PI * 4500 / rate), hp = Math.exp(-2 * Math.PI * 250 / rate);
    let low = 0, slow = 0;
    for (let i = 0; i < length; i++) { low = (1 - lp) * (next() * 2 - 1) + lp * low; slow = (1 - hp) * low + hp * slow; data[i] = (low - slow) * 2.2; }
  }
  // Crackle: ~8 small ticks per second and ~0.2 soft pops per second.
  const event = (at: number, peak: number, tau: number) => {
    const n = Math.min(length - at, Math.ceil(tau * rate * 7));
    for (let j = 0; j < n; j++) crackle[at + j] += (next() * 2 - 1) * peak * Math.exp(-j / (tau * rate));
  };
  for (let t = next() * .3; t < seconds - .01; t += -Math.log(1 - next() * .999) / 8) event(Math.floor(t * rate), .004 + next() ** 2 * .010, .00015 + next() * .00035);
  for (let t = .4 + next() * 2; t < seconds - .02; t += -Math.log(1 - next() * .999) / .2) event(Math.floor(t * rate), .006 + next() * .006, .0008 + next() * .0009);
  // Band the ticks to ~700 Hz – 5 kHz: no thump below, no sizzle above (surface noise, not fire).
  const a = Math.exp(-2 * Math.PI * 700 / rate), b = Math.exp(-2 * Math.PI * 5000 / rate);
  let low = 0, top = 0;
  for (let i = 0; i < length; i++) { low = (1 - a) * crackle[i] + a * low; top = (1 - b) * (crackle[i] - low) + b * top; crackle[i] = top * 1.6; }
  // Seamless loop: short crossfade of both ends.
  const fade = Math.floor(rate * .03);
  const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
  for (let i = 0; i < length; i++) {
    const edge = Math.min(1, i / fade, (length - 1 - i) / fade);
    left[i] = (hissL[i] * HISS_LEVEL + crackle[i] * CRACKLE_LEVEL) * edge;
    right[i] = (hissR[i] * HISS_LEVEL + crackle[i] * CRACKLE_LEVEL * .85) * edge;
  }
  return buffer;
}

export function createTape(context: BaseAudioContext, settings: Settings, noise: AudioBuffer) {
  const input = context.createGain();
  const wow = context.createDelay(.05); wow.delayTime.value = BASE_DELAY;
  const lfos = WOW.map(({ rate, share }) => {
    const lfo = context.createOscillator(), depth = context.createGain();
    lfo.frequency.value = rate; depth.gain.value = wowDepth(wowCents(settings.warmth) * share, rate);
    lfo.connect(depth).connect(wow.delayTime); return { lfo, depth, rate, share };
  });
  // The scene mix peaks near -12 dBFS; drive it into the curve and back so peaks actually bend.
  const drive = context.createGain(); drive.gain.value = SAT_DRIVE;
  const color = context.createWaveShaper(); color.oversample = '2x';
  const makeup = context.createGain(); makeup.gain.value = 1 / SAT_DRIVE;
  color.curve = Float32Array.from({ length: 4097 }, (_, i) => tapeCurve(i / 2048 - 1));
  const tone = context.createBiquadFilter(); tone.type = 'lowpass'; tone.Q.value = .6; tone.frequency.value = tapeCutoff(settings.warmth);
  const output = context.createGain();
  input.connect(wow).connect(drive).connect(color).connect(makeup).connect(tone).connect(output);
  // The noise bed joins before the scene fade so it fades in and out with the music.
  const bed = context.createBufferSource(); bed.buffer = noise; bed.loop = true;
  const bedGain = context.createGain(); bedGain.gain.value = tapeAmount(settings.warmth);
  bed.connect(bedGain);
  const now = context.currentTime;
  for (const { lfo } of lfos) lfo.start(now);
  bed.start(now);
  let stopped = false;
  return {
    input, output, bed: bedGain,
    nodes: [input, wow, drive, color, makeup, tone, output, bed, bedGain, ...lfos.flatMap(l => [l.lfo, l.depth])] as AudioNode[],
    setWarmth(warmth: number, seconds = .12) {
      const t = context.currentTime;
      const ramp = (param: AudioParam, value: number) => { param.cancelAndHoldAtTime(t); param.linearRampToValueAtTime(value, t + seconds); };
      ramp(bedGain.gain, tapeAmount(warmth)); ramp(tone.frequency, tapeCutoff(warmth));
      for (const l of lfos) ramp(l.depth.gain, wowDepth(wowCents(warmth) * l.share, l.rate));
    },
    stop(at = context.currentTime) {
      if (stopped) return; stopped = true;
      for (const { lfo } of lfos) lfo.stop(at);
      bed.stop(at);
    },
  };
}
export type Tape = ReturnType<typeof createTape>;

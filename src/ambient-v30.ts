// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { Settings } from './music';

// Generator v30 ambient: the held pad breathes. Each voice of the chord swells and fades on its
// own slow cycle (11–21 s), a little brighter as it swells and darker as it fades, and drifts
// across the stereo field on another (17–31 s). A chord held for minutes keeps changing colour
// from inside (which note leads, where it sits) without a single new partial. The cycles run on
// song time, so a note re-struck every two bars carries on where it was. No randomness at play
// time: the pitch sets each voice's cycle.
export const breathV30 = (s: Settings) => s.profile === 'ambient' && s.generatorVersion >= 30;
/** Swell depth: the voice moves between 0.6× and 1.4× its level (about −4.4 to +2.9 dB). */
export const BREATH_DEPTH = .4;
/** The voice's low-pass follows the swell, from 0.5× (faded) to 1× (full); nothing is added above it. */
export const DARKEST = .5;
/** How far a voice drifts from its place in the stereo field. */
export const DRIFT_DEPTH = .25;
/** Curve resolution (points per second); the cycles are many seconds long. */
const RATE = 8;
const frac = (x: number) => x - Math.floor(x);
export const breathPeriod = (note: number) => 11 + 10 * frac(note * .618034);
export const driftPeriod = (note: number) => 17 + 14 * frac(note * .381966 + .5);
const phase = (note: number, salt: number) => frac(note * .754877 + salt);

/** Gain and pan curves for one pad voice from `start` (song seconds) over `seconds`. */
export function breathCurves(note: number, start: number, seconds: number, pan: number) {
  const points = Math.max(2, Math.ceil(seconds * RATE) + 1), gain = new Float32Array(points), place = new Float32Array(points), bright = new Float32Array(points);
  const T = breathPeriod(note), P = driftPeriod(note), a = phase(note, 0), b = phase(note, .37);
  for (let i = 0; i < points; i++) {
    const t = start + seconds * i / (points - 1);
    const swell = Math.sin(2 * Math.PI * (t / T + a));
    gain[i] = 1 + BREATH_DEPTH * swell;
    bright[i] = DARKEST + (1 - DARKEST) * (.5 + .5 * swell);
    place[i] = Math.max(-1, Math.min(1, pan + DRIFT_DEPTH * Math.sin(2 * Math.PI * (t / P + b))));
  }
  return { gain, pan: place, bright };
}

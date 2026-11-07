// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
import type { Settings } from './music';
import { arrangementAt } from './arrangement';

// Generator v23 deep house (four-on-the-floor only; D&B keeps its own sound).
// The house voices keep their warm v22 timbre, which lives mostly between 150 Hz and 1 kHz.
// A form-following low-pass on the music bus works in that range: the intro opens from a
// muffled, "next room" mix, the groove is open, the breakdown closes, the build-up opens again.
export const houseV23 = (s: Settings) => s.profile === 'dub' && s.groove !== 'dnb' && s.generatorVersion >= 23;

// Cut-off at the start of each local bar of the 32-bar form; the filter glides exponentially to
// the next bar's value, so there are no steps. OPEN is far above anything the voices play.
export const OPEN = 20000;
const ARC = [
  180, 200, 230, 270, 320, 400, 600, OPEN,          // intro: from a muffled room to the full mix
  OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,   // groove
  280, 280, 280, 280, 300, 380, 550, 1000,          // breakdown, then build-up
  OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, 600, 250,     // return, closing into the next intro
] as const;
// Generator v31: the v23 arc closed down to 180–280 Hz, below the body of the chords (300–600 Hz),
// so the closed filter sounded muffled and far away. The floor rises to keep that body (intro from
// 350 Hz, breakdown at 550 Hz), and as the filter closes a little resonance comes in at the cut-off,
// the "filtered house" colour, so a closed mix sounds darker rather than further away.
export const houseV31 = (s: Settings) => houseV23(s) && s.generatorVersion >= 31;
const ARC_V31 = [
  350, 380, 420, 480, 560, 700, 1000, OPEN,         // intro
  OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, OPEN,   // groove
  550, 550, 550, 550, 600, 750, 1000, 1600,         // breakdown, then build-up
  OPEN, OPEN, OPEN, OPEN, OPEN, OPEN, 900, 450,     // return, closing into the next intro
] as const;
/** Resonance (dB, as Web Audio's low-pass Q) at an open filter and at a fully closed one. */
export const OPEN_Q = .7, CLOSED_Q = 4;
/** Below CLOSED_AT the full resonance applies; it fades out by RESONANCE_TOP. */
const CLOSED_AT = 600, RESONANCE_TOP = 2400;
export const sweepHz = (s: Settings, bar: number) => (houseV31(s) ? ARC_V31 : ARC)[arrangementAt(s, Math.max(0, bar)).localBar];
export function resonanceFor(s: Settings, hz: number) {
  if (!houseV31(s)) return OPEN_Q;
  const closed = Math.min(1, Math.max(0, Math.log(RESONANCE_TOP / hz) / Math.log(RESONANCE_TOP / CLOSED_AT)));
  return OPEN_Q + (CLOSED_Q - OPEN_Q) * closed;
}

/** Glide through `bar` (the song's own bar); the first call of a scene jumps to its value. */
export function scheduleSweep(filter: BiquadFilterNode, s: Settings, bar: number, barStart: number, barSeconds: number, now: number, first: boolean) {
  const from = Math.max(now, barStart), end = barStart + barSeconds;
  filter.frequency.cancelAndHoldAtTime(from);
  if (first) filter.frequency.setValueAtTime(sweepHz(s, bar), from);
  filter.frequency.exponentialRampToValueAtTime(sweepHz(s, bar + 1), end);
  // v23 songs hold the flat 0.7 (also after a v31 song on the same scene).
  filter.Q.cancelAndHoldAtTime(from);
  if (first) filter.Q.setValueAtTime(resonanceFor(s, sweepHz(s, bar)), from);
  filter.Q.linearRampToValueAtTime(resonanceFor(s, sweepHz(s, bar + 1)), end);
}
